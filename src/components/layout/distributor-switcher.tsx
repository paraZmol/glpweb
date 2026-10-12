import { ChevronsUpDown } from 'lucide-react';
import { type ChangeEvent, useId } from 'react';
import { useNavigate } from 'react-router';
import { areaForRole } from '@/domain/auth/access';
import { activeMemberships } from '@/domain/tenancy/membership';
import type { CurrentDistributor } from '@/features/tenancy/use-current-distributor';
import { useMembershipDistributorNames } from '@/features/tenancy/use-membership-distributor-names';
import { ICON_STROKE } from '@/lib/icons';
import { AREA_HOME } from '@/lib/routes';
import { cn } from '@/lib/utils';
import { ROLE_LABELS } from './role-labels';

const UNNAMED = 'Otra distribuidora';

type ReadyDistributor = Extract<CurrentDistributor, { status: 'ready' }>;

/**
 * Selector of the distributor the panels work on (PLAN 2.4). It renders nothing for an account
 * with a single distributor. Choosing one where the account has another job also changes area:
 * owner of one and driver of another lands on the right panel.
 */
export function DistributorSwitcher({
  current,
  className,
}: {
  current: ReadyDistributor;
  className?: string;
}) {
  const id = useId();
  const navigate = useNavigate();
  const memberships = activeMemberships(current.memberships);
  const names = useMembershipDistributorNames(memberships);
  if (memberships.length < 2) return null;

  const nameOf = (distributorId: string) =>
    distributorId === current.distributor.id
      ? current.distributor.name
      : (names[distributorId] ?? UNNAMED);

  const change = (event: ChangeEvent<HTMLSelectElement>) => {
    const chosen = memberships.find(
      (membership) => membership.distributorId === event.target.value,
    );
    if (!chosen) return;
    current.select(chosen.distributorId);
    void navigate(AREA_HOME[areaForRole(chosen.role)]);
  };

  return (
    <div className={cn('relative', className)}>
      <label htmlFor={id} className="sr-only">
        Cambiar de distribuidora
      </label>
      <select
        id={id}
        value={current.distributor.id}
        onChange={change}
        className="h-11 w-full cursor-pointer appearance-none truncate rounded-lg border-[1.5px] border-input bg-muted pr-9 pl-3 text-sm font-semibold text-foreground"
      >
        {memberships.map((membership) => (
          <option key={membership.distributorId} value={membership.distributorId}>
            {nameOf(membership.distributorId)} · {ROLE_LABELS[membership.role]}
          </option>
        ))}
      </select>
      <ChevronsUpDown
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
        strokeWidth={ICON_STROKE}
      />
    </div>
  );
}
