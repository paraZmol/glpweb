import { type FormEvent, useEffect, useRef, useState } from 'react';
import { FormStatus } from '@/components/account/form-parts';
import { Button } from '@/components/common/button';
import { TextField } from '@/components/common/text-field';
import { ReasonChoice } from '@/components/stock/reason-choice';
import { StockOutcome } from '@/components/stock/stock-outcome';
import type { StockLine } from '@/components/stock/stock-list';
import { productTitle } from '@/domain/catalog/product';
import { ADJUSTMENT_NOTE_MAX_LENGTH } from '@/domain/stock/constants';
import type { AdjustmentReason } from '@/domain/stock/movement';
import { adjustStock, recordStockCount } from '@/features/stock/stock-actions';
import {
  readStockForm,
  STOCK_FIELD_LABELS,
  type StockFormErrors,
  stockFormErrorsOf,
  stockFormFor,
} from '@/features/stock/stock-form';
import { useAsyncAction } from '@/lib/use-async-action';
import { useFocusFirstInvalid } from '@/lib/use-focus-first-invalid';
import { useOnlineStatus } from '@/lib/use-online-status';

const OFFLINE_TEXT = 'Sin conexión: para ajustar el stock necesitas internet.';

type StockAdjustPanelProps = {
  distributorId: string;
  authorUid: string;
  line: StockLine;
  onSaved: (message: string) => void;
  onCancel: () => void;
};

/**
 * One adjustment of the plant stock (PLAN 3.4): the reason first, then the two numbers it asks
 * for, the note (required for "Otro motivo") and what the stock will hold. It is written with
 * its author and the server's time, and can never be edited or deleted.
 */
export function StockAdjustPanel(props: StockAdjustPanelProps) {
  const { distributorId, authorUid, line, onSaved, onCancel } = props;
  const isOnline = useOnlineStatus();
  const { isRunning, run } = useAsyncAction();
  const formRef = useRef<HTMLFormElement>(null);
  const [form, setForm] = useState(() => stockFormFor('count', line.stock));
  const [errors, setErrors] = useState<StockFormErrors>({});
  useFocusFirstInvalid(formRef, errors);
  const labels = STOCK_FIELD_LABELS[form.reason];
  const title = productTitle(line.product);

  useEffect(() => {
    formRef.current?.scrollIntoView({ block: 'start' });
  }, []);

  const set = (field: 'full' | 'empty' | 'note', value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors(({ [field]: _field, form: _form, ...rest }) => rest);
  };
  const choose = (reason: AdjustmentReason) => {
    setForm((current) => ({ ...stockFormFor(reason, line.stock), note: current.note }));
    setErrors({});
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const read = readStockForm(form, line.stock);
    if (!read.ok) return setErrors(read.errors);
    if (!isOnline) return undefined;
    const note = form.note.trim() === '' ? null : form.note;
    void run(async () => {
      try {
        if (read.counted) {
          await recordStockCount(distributorId, authorUid, {
            current: line.stock,
            counted: read.counted,
            note,
          });
        } else {
          await adjustStock(distributorId, authorUid, {
            productId: line.product.id,
            reason: form.reason,
            note,
            ...read.change,
          });
        }
        onSaved(`Ajustamos el stock de ${title}.`);
      } catch (error) {
        setErrors(stockFormErrorsOf(error));
      }
    });
    return undefined;
  };

  const numberField = (field: 'full' | 'empty') => (
    <TextField
      label={labels[field]}
      name={field}
      inputMode={form.reason === 'other' ? 'text' : 'numeric'}
      autoComplete="off"
      placeholder="0"
      hint={form.reason === 'other' ? 'Con un menos si bajan: -2.' : undefined}
      value={form[field]}
      error={errors[field]}
      onChange={(event) => set(field, event.target.value)}
    />
  );

  return (
    <form
      ref={formRef}
      noValidate
      onSubmit={submit}
      aria-labelledby="stock-form-title"
      className="flex scroll-mt-[calc(var(--top-inset)+1rem)] flex-col gap-6"
    >
      <div>
        <h2 id="stock-form-title" className="text-xl font-extrabold">
          Ajustar {title}.
        </h2>
        <p className="mt-1 text-muted-foreground tabular-nums">
          Hoy figuran {line.stock.full} llenos y {line.stock.empty} vacíos. El ajuste queda en la
          bitácora con tu nombre.
        </p>
      </div>
      <ReasonChoice value={form.reason} onChange={choose} />
      <div className="grid grid-cols-2 gap-3">
        {numberField('full')}
        {numberField('empty')}
      </div>
      <TextField
        label={form.reason === 'other' ? 'Nota' : 'Nota (opcional)'}
        name="note"
        autoComplete="off"
        maxLength={ADJUSTMENT_NOTE_MAX_LENGTH}
        value={form.note}
        error={errors.note}
        onChange={(event) => set('note', event.target.value)}
      />
      <StockOutcome form={form} line={line} />
      <FormStatus error={errors.form} isOnline={isOnline} offlineText={OFFLINE_TEXT} />
      <div className="flex flex-wrap gap-3">
        <Button type="submit" loading={isRunning} loadingLabel="Guardando…" disabled={!isOnline}>
          Guardar ajuste
        </Button>
        <Button type="button" variant="line" disabled={isRunning} onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
