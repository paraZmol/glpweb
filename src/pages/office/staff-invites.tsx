import { ChevronRight } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { Bone, LoadingRegion } from '@/components/common/skeleton';
import { ErrorState } from '@/components/common/state-views';
import { Panel } from '@/components/layout/page-header';
import { type Invite, inviteStateOf } from '@/domain/staff/invite';
import type { Distributor } from '@/domain/tenancy/types';
import { type Actor, linkOfInvite, revokeStaffInvite } from '@/features/staff/staff-actions';
import { ICON_STROKE } from '@/lib/icons';
import { useLastReady } from '@/lib/use-last-ready';
import type { ReloadableResource } from '@/lib/use-async-resource';
import { InviteRow } from './invite-row';
import { useStaffWrite } from './use-staff-write';

type StaffInvitesProps = {
  invites: ReloadableResource<Invite[]>;
  distributor: Distributor;
  actor: Actor;
  /** Full address of `/unirme`, without `#`. */
  joinUrl: string;
  canShare: boolean;
  isOnline: boolean;
};

function InvitesSkeleton() {
  return (
    <LoadingRegion label="Cargando las invitaciones" className="flex flex-col gap-2 py-4">
      <Bone className="h-5 w-40" />
      <Bone className="h-4 w-64" />
    </LoadingRegion>
  );
}

/**
 * The ones past their days, folded under "Vencidas (N)": they no longer let anybody in, and
 * left open they piled up over the ones that still work. Each can still be withdrawn.
 */
function ExpiredInvites({ count, children }: { count: number; children: ReactNode }) {
  return (
    <details className="group mt-2 border-t pt-2">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1.5 rounded-md font-heading text-[0.9375rem] font-bold text-muted-foreground tabular-nums [&::-webkit-details-marker]:hidden">
        <ChevronRight
          aria-hidden="true"
          className="size-4 transition-transform motion-fast group-open:rotate-90 motion-reduce:transition-none"
          strokeWidth={ICON_STROKE}
        />
        Vencidas ({count})
      </summary>
      <div className="flex flex-col divide-y">{children}</div>
    </details>
  );
}

/**
 * The invitations that wait (PLAN 3.2), newest first. The ones past their 7 days go folded
 * under "Vencidas (N)" until the owner withdraws them. A used one leaves the list: that person
 * is in the staff now.
 */
export function StaffInvites(props: StaffInvitesProps) {
  const { invites, distributor, actor, joinUrl, canShare, isOnline } = props;
  const { data, isRefreshing } = useLastReady(invites, distributor.id);
  const write = useStaffWrite(invites.reload);
  const isLocked = write.busy !== null || isRefreshing || !isOnline;
  // When the screen opened: an invitation that runs out while it is open fails on use.
  const [now] = useState(() => new Date());

  const rowOf = (invite: Invite) => {
    const ref = { distributorId: distributor.id, code: invite.id };
    return (
      <InviteRow
        key={invite.id}
        invite={invite}
        link={linkOfInvite(ref, joinUrl)}
        distributorName={distributor.name}
        now={now}
        canShare={canShare}
        isLocked={isLocked}
        isBusy={write.busy === invite.id}
        onRevoke={() =>
          write.run(invite.id, () => revokeStaffInvite(ref, actor), 'Invitación anulada.')
        }
      />
    );
  };
  const usable = data?.filter((invite) => inviteStateOf(invite, now) === 'usable') ?? [];
  const expired = data?.filter((invite) => inviteStateOf(invite, now) !== 'usable') ?? [];

  if (invites.status === 'error' && !data) {
    return (
      <ErrorState
        title="No pudimos cargar las invitaciones."
        description="Puede ser la conexión. Vuelve a intentar en un momento."
        onRetry={invites.reload}
        className="rounded-lg"
      />
    );
  }

  return (
    <Panel dense>
      <h2 className="text-lg font-bold">Invitaciones que esperan</h2>
      {!data && <InvitesSkeleton />}
      {data && usable.length === 0 && (
        <p className="mt-2 max-w-prose text-muted-foreground">
          Ninguna invitación espera. Cada una sirve una sola vez y vence a los 7 días.
        </p>
      )}
      {usable.length > 0 && <div className="flex flex-col divide-y">{usable.map(rowOf)}</div>}
      {expired.length > 0 && (
        <ExpiredInvites count={expired.length}>{expired.map(rowOf)}</ExpiredInvites>
      )}
    </Panel>
  );
}
