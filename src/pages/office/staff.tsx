import { UserPlus } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/common/button';
import { InlineAlert } from '@/components/common/inline-alert';
import { Bone, LoadingRegion } from '@/components/common/skeleton';
import { PageHeader, Panel } from '@/components/layout/page-header';
import { DeniedRedirect } from '@/components/layout/require-access';
import { useAccount } from '@/features/account/account-context';
import { usePendingInvites } from '@/features/staff/use-staff';
import { ICON_STROKE } from '@/lib/icons';
import { usePageTitle } from '@/lib/page-title';
import { AREA_HOME, ROUTES } from '@/lib/routes';
import { useOnlineStatus } from '@/lib/use-online-status';
import { InviteForm } from './invite-form';
import { isSuspended, SuspendedNotice } from './read-only-notice';
import { PLAN_READ_ONLY } from './staff-copy';
import { StaffHelpers } from './staff-helpers';
import { StaffInvites } from './staff-invites';
import { MembersSkeleton, StaffMembers } from './staff-members';

/** The address the links of the invitations open: this same site, at `/unirme`. */
function joinUrlOf(): string {
  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  return `${origin}${ROUTES.join}`;
}

function StaffPageSkeleton() {
  return (
    <LoadingRegion label="Cargando tu personal" className="flex flex-col gap-6">
      <Bone className="h-8 w-56" />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_26rem]">
        <div className="rounded-lg bg-card p-5 shadow-card lg:p-7">
          <MembersSkeleton />
        </div>
        <Bone className="h-64 rounded-lg" />
      </div>
    </LoadingRegion>
  );
}

/**
 * `/central/personal` (PLAN 3.2), owners only: the staff with its roles, the invitations that
 * wait and the helpers. Desktop: the staff and the invitations on the left, the form to invite
 * and the helpers on the right. Phone: the form first, where the button was. A read-only
 * distributor shows everything under its notice, and only lets invitations be withdrawn.
 */
export function StaffPage() {
  usePageTitle('Personal');
  const { current, session } = useAccount();
  const isOnline = useOnlineStatus();
  const distributorId = current.status === 'ready' ? current.distributor.id : null;
  const invites = usePendingInvites(distributorId);
  // Remembered with its distributor: switching to another one closes the form.
  const [invitingAt, setInvitingAt] = useState<string | null>(null);
  if (current.status !== 'ready') return <StaffPageSkeleton />;
  const { distributor, membership, isWritable } = current;
  if (membership.role !== 'owner') return <DeniedRedirect to={AREA_HOME.office} />;

  const actor = { uid: session.uid, email: session.email };
  const isInviting = isWritable && invitingAt === distributor.id;
  const joinUrl = joinUrlOf();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        dense
        title="Tu personal."
        lead={`Quién trabaja en ${distributor.name}, las invitaciones que esperan y los ayudantes de reparto.`}
        aside={
          isWritable &&
          !isInviting && (
            <Button
              type="button"
              className="max-sm:w-full"
              onClick={() => setInvitingAt(distributor.id)}
            >
              <UserPlus aria-hidden="true" strokeWidth={ICON_STROKE} />
              Invitar a alguien
            </Button>
          )
        }
      />
      {!isWritable && (
        <InlineAlert tone="info">
          {isSuspended(distributor.status) ? <SuspendedNotice /> : PLAN_READ_ONLY}
        </InlineAlert>
      )}
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-[minmax(0,1fr)_26rem] lg:grid-rows-[auto_1fr]">
        {isInviting && (
          <Panel dense className="lg:col-start-2 lg:row-start-1">
            <InviteForm
              key={distributor.id}
              distributor={distributor}
              actor={actor}
              joinUrl={joinUrl}
              isOnline={isOnline}
              onCreated={invites.reload}
              onClose={() => setInvitingAt(null)}
            />
          </Panel>
        )}
        <div className="flex flex-col gap-4 lg:col-start-1 lg:row-span-2 lg:row-start-1">
          <StaffMembers
            distributor={distributor}
            actor={actor}
            canEdit={isWritable}
            isOnline={isOnline}
          />
          <StaffInvites
            invites={invites}
            distributor={distributor}
            actor={actor}
            joinUrl={joinUrl}
            canShare={isWritable}
            isOnline={isOnline}
          />
        </div>
        <div className="lg:col-start-2">
          <StaffHelpers distributorId={distributor.id} canEdit={isWritable} isOnline={isOnline} />
        </div>
      </div>
    </div>
  );
}
