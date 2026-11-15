import { InlineAlert } from '@/components/common/inline-alert';
import type { StockOutcome as Outcome } from '@/features/stock/stock-form';
import { changeText } from './movement-list';

const BELOW_ZERO = 'Con ese ajuste el stock quedaría por debajo de cero. Revisa las cantidades.';

/** "1 lleno", "43 llenos". */
function Count({ value, one, many }: { value: number; one: string; many: string }) {
  return (
    <>
      <span className="tabular-nums">{value}</span> {value === 1 ? one : many}
    </>
  );
}

/** What the form would leave, said before saving: "Quedan 43 llenos y 11 vacíos". */
export function StockOutcome({ outcome }: { outcome: Outcome }) {
  if (!outcome) return null;
  if (outcome.kind === 'belowZero') return <InlineAlert tone="error">{BELOW_ZERO}</InlineAlert>;
  if (outcome.kind === 'overCap') {
    return (
      <InlineAlert tone="error">
        El stock admite hasta {outcome.cap} balones de cada tipo. Revisa las cantidades.
      </InlineAlert>
    );
  }
  const change = changeText(outcome.change);
  const { full, empty } = outcome.after;
  return (
    <p
      role="status"
      aria-live="polite"
      className="rounded-lg bg-muted p-3.5 text-[0.9375rem] font-semibold"
    >
      {change ? (
        <>
          <span className="font-heading font-bold tabular-nums">{change}</span>. Quedan{' '}
          <Count value={full} one="lleno" many="llenos" /> y{' '}
          <Count value={empty} one="vacío" many="vacíos" />.
        </>
      ) : (
        'Sin cambios todavía.'
      )}
    </p>
  );
}
