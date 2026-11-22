import { type FormEvent, useState } from 'react';
import type { StockLine } from '@/components/stock/stock-list';
import { StockChangedError } from '@/domain/stock/errors';
import type { AdjustmentReason } from '@/domain/stock/movement';
import type { PlantStock } from '@/domain/stock/plant-stock';
import { adjustStock, recordStockCount } from '@/features/stock/stock-actions';
import {
  type ReadStockForm,
  readStockForm,
  type StockFormErrors,
  stockFormErrorsOf,
  stockFormFor,
  stockOutcomeOf,
} from '@/features/stock/stock-form';
import { useAsyncAction } from '@/lib/use-async-action';

type StockAdjustOptions = {
  distributorId: string;
  authorUid: string;
  line: StockLine;
  isOnline: boolean;
  onSaved: () => void;
  /** The stock changed while the person counted: the list behind should read it again. */
  onStale: () => void;
};

/**
 * The state of one adjustment of the plant stock (PLAN 3.4). `seen` is the stock the person
 * has on screen ("Hoy figuran…"): a count is a total typed against it, so when it changed
 * meanwhile nothing is saved, `seen` becomes the stock of the moment and the form says so.
 */
export function useStockAdjust(options: StockAdjustOptions) {
  const { distributorId, authorUid, line, isOnline, onSaved, onStale } = options;
  const { isRunning, run } = useAsyncAction();
  const [seen, setSeen] = useState<PlantStock>(line.stock);
  const [form, setForm] = useState(() => stockFormFor('count', line.stock));
  const [errors, setErrors] = useState<StockFormErrors>({});
  const outcome = stockOutcomeOf(form, seen);

  const set = (field: 'full' | 'empty' | 'note', value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors(({ [field]: _field, form: _form, ...rest }) => rest);
  };
  const choose = (reason: AdjustmentReason) => {
    setForm((current) => ({ ...stockFormFor(reason, seen), note: current.note }));
    setErrors({});
  };

  const save = async ({ change, counted }: Extract<ReadStockForm, { ok: true }>) => {
    const note = form.note.trim() === '' ? null : form.note;
    try {
      if (counted) {
        await recordStockCount(distributorId, authorUid, { current: seen, counted, note });
      } else {
        await adjustStock(distributorId, authorUid, {
          productId: line.product.id,
          reason: form.reason,
          note,
          ...change,
        });
      }
      onSaved();
    } catch (error) {
      if (error instanceof StockChangedError) {
        setSeen((current) => ({ ...current, ...error.now }));
        onStale();
      }
      setErrors(stockFormErrorsOf(error));
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const read = readStockForm(form, seen);
    if (!read.ok) return setErrors(read.errors);
    // Below zero is already said above the buttons: saving would only say it a second time.
    if (!isOnline || outcome?.kind === 'belowZero') return undefined;
    void run(() => save(read));
    return undefined;
  };

  return { form, errors, seen, outcome, isRunning, set, choose, submit };
}
