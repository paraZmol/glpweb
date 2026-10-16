import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { ErrorState } from '@/components/common/state-views';
import { ROLE_LABELS } from '@/components/layout/role-labels';
import { areaForRole } from '@/domain/auth/access';
import { AlreadyMemberError, InviteNotFoundError } from '@/domain/staff/errors';
import { inviteRefusalFor, type Joiner } from '@/domain/staff/invite-input';
import { type Invite, parseInviteFragment } from '@/domain/staff/invite';
import type { Member, MemberRole } from '@/domain/tenancy/types';
import { useAccount } from '@/features/account/account-context';
import { joinWithInvite } from '@/features/staff/staff-actions';
import { describeJoinError } from '@/features/staff/staff-messages';
import { useInvite } from '@/features/staff/use-staff';
import { rememberDistributor } from '@/features/tenancy/selection-storage';
import { dropAddressFragment } from '@/lib/address-fragment';
import { usePageTitle } from '@/lib/page-title';
import { AREA_HOME } from '@/lib/routes';
import { useAsyncAction } from '@/lib/use-async-action';
import { useOnlineStatus } from '@/lib/use-online-status';
import { JoinCard } from './join-card';
import { JoinFrame, JoinSkeleton } from './join-frame';
import { isInvitationRefusal } from './join-copy';
import { BrokenLink, JoinRefused } from './join-stop';

/** Why the account cannot use the invitation as it stands, or null when it can. */
function refusalOf(invite: Invite | null, member: Member | undefined, joiner: Joiner, now: Date) {
  if (!invite) return new InviteNotFoundError();
  if (member) return new AlreadyMemberError(member.active);
  return inviteRefusalFor(invite, joiner, now);
}

/**
 * `/unirme` (PLAN 3.2): the screen an invitation link opens. The link carries the distributor
 * and the code in its fragment, which never reaches a server and is never stored: the guards
 * hand it on through the sign-in and the terms step. Once here, the page keeps it in memory and
 * takes it out of the address bar (PLAN §11, 2026-10-16). It shows where and as what the account is
 * invited, or why it cannot be used; after joining, the account lands on the area of its new
 * role with that distributor selected.
 */
export function JoinPage() {
  usePageTitle('Invitación');
  const { hash } = useLocation();
  // The link stays in memory once the address bar no longer shows it; another link opened in
  // the same tab replaces it.
  const [linkHash, setLinkHash] = useState(hash);
  if (hash !== '' && hash !== linkHash) setLinkHash(hash);
  const ref = useMemo(() => parseInviteFragment(linkHash), [linkHash]);
  useEffect(() => {
    if (hash !== '') dropAddressFragment();
  }, [hash]);
  const invite = useInvite(ref);
  const { session, profile, current } = useAccount();
  const navigate = useNavigate();
  const isOnline = useOnlineStatus();
  const { isRunning, run } = useAsyncAction();
  const [now] = useState(() => new Date());
  // A refusal of the attempt itself (another account used it a moment before, it was withdrawn
  // meanwhile): it takes the screen like the same refusal found on arrival.
  const [failure, setFailure] = useState<Error | null>(null);

  const enter = (distributorId: string, role: MemberRole) => {
    if (current.status === 'ready') current.select(distributorId);
    else rememberDistributor(session.uid, distributorId);
    if (current.status === 'ready' || current.status === 'none') current.reload();
    void navigate(AREA_HOME[areaForRole(role)], { replace: true });
  };

  if (!ref) {
    return (
      <JoinFrame explains={false}>
        <BrokenLink />
      </JoinFrame>
    );
  }
  const memberships =
    current.status === 'ready' || current.status === 'none' ? current.memberships : null;
  if (invite.status === 'error') {
    return (
      <JoinFrame explains={false}>
        <ErrorState
          titleLevel={1}
          title={isOnline ? 'No pudimos abrir la invitación.' : 'Sin conexión.'}
          description="Para ver la invitación necesitas internet. Vuelve a intentar en un momento."
          onRetry={invite.reload}
        />
      </JoinFrame>
    );
  }
  if (invite.status !== 'ready' || memberships === null) {
    return (
      <JoinFrame>
        <JoinSkeleton />
      </JoinFrame>
    );
  }

  const found = invite.data;
  const member = memberships.find((membership) => membership.distributorId === ref.distributorId);
  const refusal =
    (failure && isInvitationRefusal(failure) ? failure : null) ??
    refusalOf(found, member, { uid: session.uid, email: session.email ?? '' }, now);
  if (refusal || !found) {
    return (
      <JoinFrame explains={false}>
        <JoinRefused
          linkHash={linkHash}
          refusal={refusal ?? new InviteNotFoundError()}
          distributorName={found?.distributorName ?? null}
          email={session.email}
          onEnter={member?.active ? () => enter(member.distributorId, member.role) : undefined}
        />
      </JoinFrame>
    );
  }

  const join = () =>
    void run(async () => {
      setFailure(null);
      try {
        const joined = await joinWithInvite(ref, session);
        toast.success(`Te uniste a ${found.distributorName} como ${ROLE_LABELS[joined.role]}.`);
        enter(joined.distributorId, joined.role);
      } catch (attempt) {
        setFailure(attempt instanceof Error ? attempt : new Error(String(attempt)));
      }
    });

  return (
    <JoinFrame>
      <JoinCard
        invite={found}
        you={{ name: profile?.displayName ?? session.displayName ?? '', email: session.email }}
        isRunning={isRunning}
        isOnline={isOnline}
        error={failure ? describeJoinError(failure) : undefined}
        onJoin={join}
      />
    </JoinFrame>
  );
}
