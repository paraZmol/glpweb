import { Monogram } from '@/components/brand/monogram';
import type { CurrentDistributor } from '@/features/tenancy/use-current-distributor';
import { cn } from '@/lib/utils';
import { DistributorSwitcher } from './distributor-switcher';
import { ROLE_LABELS } from './role-labels';

type ReadyDistributor = Extract<CurrentDistributor, { status: 'ready' }>;

/**
 * Which distributor the panel is showing and in which role, with the selector when the account
 * belongs to several. `compact` is the one-line version for the top bar of the phone.
 */
export function Workplace({ current, compact }: { current: ReadyDistributor; compact?: boolean }) {
  const { distributor, membership } = current;
  return (
    <div
      className={cn(
        'flex min-w-0 gap-3',
        compact ? 'flex-1 items-center justify-between' : 'flex-col',
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <Monogram name={distributor.name} size="sm" />
        <div className="min-w-0 leading-tight">
          <p className="truncate font-heading text-base font-bold">{distributor.name}</p>
          <p className="truncate text-[0.8125rem] font-semibold text-muted-foreground">
            {ROLE_LABELS[membership.role]}
          </p>
        </div>
      </div>
      <DistributorSwitcher current={current} className={compact ? 'w-40 shrink-0' : undefined} />
    </div>
  );
}
