import { useState } from 'react';
import { Button } from '@/components/common/button';
import { ConfirmPanel } from '@/components/common/confirm-panel';
import { StateChip } from '@/components/common/state-chip';
import { ROLE_LABELS } from '@/components/layout/role-labels';
import { DEFAULT_TIMEZONE } from '@/domain/tenancy/constants';
import { type Invite, inviteExpiresAt, inviteStateOf } from '@/domain/staff/invite';
import { inviteStateLabelOf } from '@/features/staff/staff-messages';
import { formatDateTime } from '@/lib/format-date';
import { InviteShare } from './invite-share';
import { ANY_ACCOUNT } from './staff-copy';

type InviteRowProps = {
  invite: Invite;
  link: string;
  distributorName: string;
  now: Date;
  /** False on a read-only distributor: nobody could join with it, so it is not shared. */
  canShare: boolean;
  isLocked: boolean;
  isBusy: boolean;
  onRevoke: () => Promise<boolean>;
};

/**
 * One invitation that waits (PLAN 3.2): for which role and account, until when, how to share it
 * again and how to withdraw it. Withdrawing asks first: the link stops working at once.
 */
export function InviteRow(props: InviteRowProps) {
  const { invite, link, distributorName, now, canShare, isLocked, isBusy, onRevoke } = props;
  const [isAsking, setAsking] = useState(false);
  const isUsable = inviteStateOf(invite, now) === 'usable';
  const until = formatDateTime(inviteExpiresAt(invite), DEFAULT_TIMEZONE);
  const role = ROLE_LABELS[invite.role];
  const which = `de ${role}${invite.email ? ` para ${invite.email}` : ''}`;

  return (
    <article aria-label={`Invitación ${which}`} className="flex flex-col gap-3 py-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
        <div className="flex min-w-0 flex-col items-start gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-heading text-base font-bold">{role}</h3>
            <StateChip state={isUsable ? 'paused' : 'danger'}>
              {inviteStateLabelOf(isUsable ? 'usable' : 'expired')}
            </StateChip>
          </div>
          <p className="max-w-full text-sm font-semibold wrap-anywhere">
            {invite.email ?? ANY_ACCOUNT}
          </p>
          <p className="text-sm whitespace-nowrap text-muted-foreground tabular-nums">
            {isUsable ? `Vence el ${until}` : `Venció el ${until}`}
          </p>
        </div>
        {!isAsking && (
          // Phone: WhatsApp alone on the first line (the way the link usually travels), "Copiar
          // enlace" and "Anular" under it. Desktop: the three in a row, at the right.
          <div className="grid grid-cols-[auto_auto] justify-start gap-2 [&_a]:col-span-2 [&_a]:justify-self-start lg:flex lg:shrink-0 lg:items-center lg:justify-end">
            {isUsable && canShare && (
              <InviteShare
                link={link}
                distributorName={distributorName}
                role={invite.role}
                which={which}
                className="contents"
              />
            )}
            <Button
              type="button"
              variant="quiet"
              size="sm"
              disabled={isLocked}
              onClick={() => setAsking(true)}
            >
              Anular<span className="sr-only"> la invitación {which}</span>
            </Button>
          </div>
        )}
      </div>
      {isAsking && (
        <ConfirmPanel
          title="¿Anular esta invitación?"
          actions={
            <>
              <Button type="button" variant="line" size="sm" onClick={() => setAsking(false)}>
                Volver
              </Button>
              <Button
                type="button"
                variant="ink"
                size="sm"
                disabled={isLocked && !isBusy}
                loading={isBusy}
                loadingLabel="Anulando…"
                onClick={() => void onRevoke().then((done) => done || setAsking(false))}
              >
                Sí, anular
              </Button>
            </>
          }
        >
          <p className="mt-1 text-muted-foreground">
            El enlace deja de funcionar al momento. Si ya la usaron, desactiva a esa persona en tu
            personal.
          </p>
        </ConfirmPanel>
      )}
    </article>
  );
}
