import { useEffect, useRef } from 'react';
import { FormStatus } from '@/components/account/form-parts';
import { Button } from '@/components/common/button';
import { TextField } from '@/components/common/text-field';
import { ReasonChoice } from '@/components/stock/reason-choice';
import { StockOutcome } from '@/components/stock/stock-outcome';
import type { StockLine } from '@/components/stock/stock-list';
import { productTitle } from '@/domain/catalog/product';
import { ADJUSTMENT_NOTE_MAX_LENGTH } from '@/domain/stock/constants';
import { STOCK_FIELD_LABELS } from '@/features/stock/stock-form';
import { levelsText } from '@/features/stock/stock-messages';
import { useFocusFirstInvalid } from '@/lib/use-focus-first-invalid';
import { useOnlineStatus } from '@/lib/use-online-status';
import { useStockAdjust } from './use-stock-adjust';

const OFFLINE_TEXT = 'Sin conexión: para ajustar el stock necesitas internet.';

type StockAdjustPanelProps = {
  distributorId: string;
  authorUid: string;
  line: StockLine;
  onSaved: (message: string) => void;
  /** The stock changed while the form was open: the list behind should read it again. */
  onStale: () => void;
  onCancel: () => void;
};

/**
 * One adjustment of the plant stock (PLAN 3.4): the reason first, then the two numbers it asks
 * for, the note (required for "Otro motivo") and what the stock will hold. It is written with
 * its author and the server's time, and can never be edited or deleted.
 */
export function StockAdjustPanel(props: StockAdjustPanelProps) {
  const { line, onSaved, onCancel } = props;
  const isOnline = useOnlineStatus();
  const formRef = useRef<HTMLFormElement>(null);
  const title = productTitle(line.product);
  const adjust = useStockAdjust({
    ...props,
    isOnline,
    onSaved: () => onSaved(`Ajustamos el stock de ${title}.`),
  });
  const { form, errors, set } = adjust;
  useFocusFirstInvalid(formRef, errors);
  const labels = STOCK_FIELD_LABELS[form.reason];

  useEffect(() => {
    formRef.current?.scrollIntoView({ block: 'start' });
  }, []);

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
      onSubmit={adjust.submit}
      aria-labelledby="stock-form-title"
      className="flex scroll-mt-[calc(var(--top-inset)+1rem)] flex-col gap-6"
    >
      <div>
        <h2 id="stock-form-title" className="text-xl font-extrabold">
          Ajustar {title}.
        </h2>
        <p className="mt-1 text-muted-foreground tabular-nums">
          Hoy figuran {levelsText(adjust.seen)}. El ajuste queda en la bitácora con tu nombre.
        </p>
      </div>
      <ReasonChoice value={form.reason} onChange={adjust.choose} />
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
      <StockOutcome outcome={adjust.outcome} />
      <FormStatus error={errors.form} isOnline={isOnline} offlineText={OFFLINE_TEXT} />
      <div className="flex flex-wrap gap-3">
        <Button
          type="submit"
          loading={adjust.isRunning}
          loadingLabel="Guardando…"
          disabled={!isOnline}
        >
          Guardar ajuste
        </Button>
        <Button type="button" variant="line" disabled={adjust.isRunning} onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
