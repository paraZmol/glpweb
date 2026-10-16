import { FormStatus } from '@/components/account/form-parts';
import { BrandTheme } from '@/components/brand/brand-theme';
import { Highlight } from '@/components/brand/highlight';
import { Monogram } from '@/components/brand/monogram';
import { Button, ButtonLink } from '@/components/common/button';
import { ROLE_DUTIES, ROLE_LABELS } from '@/components/layout/role-labels';
import { type Invite, inviteExpiresAt } from '@/domain/staff/invite';
import { DEFAULT_TIMEZONE } from '@/domain/tenancy/constants';
import { invitedRoleOf } from '@/features/staff/invite-message';
import { formatDateTime } from '@/lib/format-date';
import { ROUTES } from '@/lib/routes';

const OFFLINE_TEXT = 'Sin conexión: para unirte necesitas internet.';

type JoinCardProps = {
  invite: Invite;
  /** Who is signed in: the name its staff will see, and its Google address. */
  you: { name: string; email: string | null };
  isRunning: boolean;
  isOnline: boolean;
  error?: string;
  onJoin: () => void;
};

/**
 * An invitation that can be used (PLAN 3.2): where, as what, who invites, until when, and
 * "Unirme", in the colour of the distributor. Who invites and the colour are copies the
 * invitation carries (PLAN §11, 2026-10-15): an older one has neither, and the card says the rest.
 */
export function JoinCard({ invite, you, isRunning, isOnline, error, onJoin }: JoinCardProps) {
  const name = invite.distributorName;
  const facts = [
    ...(invite.invitedByName ? [['Te invita', invite.invitedByName]] : []),
    ['Rol', `${ROLE_LABELS[invite.role]}. ${ROLE_DUTIES[invite.role]}`],
    ['Vence el', formatDateTime(inviteExpiresAt(invite), DEFAULT_TIMEZONE)],
    ['Entras como', you.email ? `${you.name} · ${you.email}` : you.name],
  ];
  return (
    <BrandTheme color={invite.brandColor}>
      <section className="flex flex-col gap-6 rounded-xl bg-card p-6 shadow-card lg:p-8">
        <div className="flex items-center gap-3">
          <Monogram name={name} />
          <p className="text-[0.9375rem] font-bold text-muted-foreground">Invitación de personal</p>
        </div>
        <h1 className="text-[2.125rem] font-extrabold text-balance wrap-anywhere lg:text-[2.5rem]">
          <Highlight>{name}</Highlight> te invita como {invitedRoleOf(invite.role)}.
        </h1>
        <dl className="flex flex-col divide-y rounded-lg bg-muted px-4">
          {facts.map(([term, value]) => (
            <div key={term} className="flex flex-col gap-0.5 py-3 sm:flex-row sm:gap-4">
              <dt className="shrink-0 font-semibold text-muted-foreground sm:w-32">{term}</dt>
              <dd className="min-w-0 font-semibold wrap-anywhere tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
        <FormStatus error={error} isOnline={isOnline} offlineText={OFFLINE_TEXT} />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button
            type="button"
            size="lg"
            // A long name wraps inside the button instead of pushing the page sideways.
            className="h-auto min-h-14 py-3 text-balance whitespace-normal sm:flex-1"
            loading={isRunning}
            loadingLabel="Uniéndote…"
            disabled={!isOnline}
            onClick={onJoin}
          >
            Unirme a {name}
          </Button>
          <ButtonLink to={ROUTES.appEntry} variant="quiet">
            Ahora no
          </ButtonLink>
        </div>
      </section>
    </BrandTheme>
  );
}
