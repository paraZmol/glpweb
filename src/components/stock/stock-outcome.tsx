import { InlineAlert } from '@/components/common/inline-alert';
import { levelsAfter, readStockForm, type StockForm } from '@/features/stock/stock-form';
import { changeText } from './movement-list';
import type { StockLine } from './stock-list';

/** What the form would leave, said before saving: "Quedan 43 llenos y 11 vacíos". */
export function StockOutcome({ form, line }: { form: StockForm; line: StockLine }) {
  const read = readStockForm(form, line.stock);
  if (!read.ok) return null;
  const after = levelsAfter(line.stock, read.change);
  if (!after) {
    return (
      <InlineAlert tone="error">
        Con ese ajuste el stock quedaría por debajo de cero. Revisa las cantidades.
      </InlineAlert>
    );
  }
  const change = changeText(read.change);
  return (
    <p aria-live="polite" className="rounded-lg bg-muted p-3.5 text-[0.9375rem] font-semibold">
      {change ? (
        <>
          <span className="font-heading font-bold tabular-nums">{change}</span>. Quedan{' '}
          <span className="tabular-nums">{after.full}</span> llenos y{' '}
          <span className="tabular-nums">{after.empty}</span> vacíos.
        </>
      ) : (
        'Sin cambios todavía.'
      )}
    </p>
  );
}
