import { useState } from 'react';
import { Bone, LoadingRegion } from '@/components/common/skeleton';
import { ErrorState } from '@/components/common/state-views';
import { Panel } from '@/components/layout/page-header';
import type { Invite } from '@/domain/staff/invite';
import type { Distributor } from '@/domain/tenancy/types';
import { type Actor, linkOfInvite, revokeStaffInvite } from '@/features/staff/staff-actions';
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
 * The invitations that wait (PLAN 3.2), newest first. One past its 7 days still shows, as
 * "Venció", until the owner withdraws it. A used one leaves the list: that person is in the
 * staff now.
 */
export function StaffInvites(props: StaffInvitesProps) {
  const { invites, distributor, actor, joinUrl, canShare, isOnline } = props;
  const { data, isRefreshing } = useLastReady(invites, distributor.id);
  const write = useStaffWrite(invites.reload);
  const isLocked = write.busy !== null || isRefreshing || !isOnline;
  // When the screen opened: an invitation that runs out while it is open fails on use.
  const [now] = useState(() => new Date());

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
      {data?.length === 0 && (
        <p className="mt-2 max-w-prose text-muted-foreground">
          Ninguna invitación espera. Cada una sirve una sola vez y vence a los 7 días.
        </p>
      )}
      {data && data.length > 0 && (
        <div className="flex flex-col divide-y">
          {data.map((invite) => {
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
          })}
        </div>
      )}
    </Panel>
  );
}
