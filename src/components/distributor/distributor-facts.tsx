import { formatMoney } from '@/domain/money/format';
import { describeDays } from '@/domain/tenancy/schedule';
import type { PublicDistributor } from '@/domain/tenancy/types';
import { cn } from '@/lib/utils';

type Fact = { value: string; label: string };

/** Only what the public profile really carries: no ratings nor delivery times yet. */
function factsOf(distributor: PublicDistributor): Fact[] {
  const facts: Fact[] = [
    { value: `${distributor.coverageRadiusKm} km`, label: 'de cobertura' },
    { value: describeDays(distributor.schedule.days), label: 'atiende' },
  ];
  if (distributor.priceFromCents !== null) {
    facts.push({
      value: formatMoney(distributor.priceFromCents, distributor.currency),
      label: 'recarga desde',
    });
  }
  return facts;
}

/** Strip of two or three facts that rides on the cover of the page (ui-system §14). */
export function DistributorFacts({
  distributor,
  className,
}: {
  distributor: PublicDistributor;
  className?: string;
}) {
  const facts = factsOf(distributor);
  return (
    <ul
      className={cn(
        'grid auto-cols-fr grid-flow-col divide-x rounded-xl bg-card py-3 text-center shadow-raised',
        className,
      )}
    >
      {facts.map((fact) => (
        <li key={fact.label} className="flex flex-col justify-center px-2">
          <span className="font-heading text-lg leading-tight font-extrabold text-balance tabular-nums lg:text-xl">
            {fact.value}
          </span>
          <span className="text-[0.8125rem] font-semibold text-muted-foreground">{fact.label}</span>
        </li>
      ))}
    </ul>
  );
}
