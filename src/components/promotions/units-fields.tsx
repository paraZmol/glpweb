import { Minus, Plus } from 'lucide-react';
import { useId } from 'react';
import { CheckboxField } from '@/components/common/checkbox-field';
import { FieldError, TextField } from '@/components/common/text-field';
import { MAX_UNITS_PER_ORDER } from '@/domain/pricing/constants';
import type { PromotionForm } from '@/features/promotions/promotion-templates';
import { ICON_STROKE } from '@/lib/icons';
import { cn } from '@/lib/utils';

const STEP_BUTTON =
  'press-stepper grid size-11 place-items-center rounded-full transition-colors motion-instant disabled:opacity-40';
const TOTAL_HINT =
  '¿Cuántos balones como máximo quieres vender con esta promoción? Al llegar a ese número, deja de aplicarse.';

type UnitsFieldsProps = {
  form: PromotionForm;
  /** "Lleva X, paga Y" moves by X; "al precio del gas" is fixed at 1 (D5). */
  step: number;
  isFixed: boolean;
  /** "Al precio del gas" and "lleva X, paga Y" cannot go without a total cap (D15). */
  needsTotal: boolean;
  errors: { maxUnitsPerOrder?: string; totalUnits?: string };
  set: (patch: Partial<PromotionForm>) => void;
};

/** "Máximo por pedido" with +/− (ui-system §8); a fixed one is only said, with nothing to press. */
function MaxPerOrder({ form, step, isFixed, errors, set }: Omit<UnitsFieldsProps, 'needsTotal'>) {
  const labelId = useId();
  const value = form.maxUnitsPerOrder;
  if (isFixed) {
    return (
      <p className="text-[0.9375rem]">
        <strong className="font-semibold">Máximo por pedido:</strong>{' '}
        <span className="font-heading font-bold tabular-nums">{value}</span>{' '}
        <span className="text-muted-foreground">(fijo en esta promoción)</span>
      </p>
    );
  }
  return (
    <div role="group" aria-labelledby={labelId}>
      <p id={labelId} className="mb-1.5 text-[0.9375rem] font-semibold">
        Máximo por pedido
      </p>
      <div className="inline-flex items-center gap-1 rounded-full bg-muted p-1">
        <button
          type="button"
          aria-label="Uno menos por pedido"
          disabled={value - step < step}
          onClick={() => set({ maxUnitsPerOrder: value - step })}
          className={cn(STEP_BUTTON, 'bg-card shadow-card')}
        >
          <Minus aria-hidden="true" className="size-5" strokeWidth={ICON_STROKE} />
        </button>
        <output
          aria-live="polite"
          className="min-w-14 text-center font-heading text-lg font-bold tabular-nums"
        >
          {value}
        </output>
        <button
          type="button"
          aria-label="Uno más por pedido"
          disabled={value + step > MAX_UNITS_PER_ORDER}
          onClick={() => set({ maxUnitsPerOrder: value + step })}
          className={cn(STEP_BUTTON, 'bg-primary text-primary-foreground')}
        >
          <Plus aria-hidden="true" className="size-5" strokeWidth={ICON_STROKE} />
        </button>
      </div>
      {errors.maxUnitsPerOrder && (
        <FieldError id={`${labelId}-error`}>{errors.maxUnitsPerOrder}</FieldError>
      )}
      <p className="mt-1.5 text-sm text-muted-foreground">
        Cuenta todo el pedido; lo que pase de ahí va a precio de lista.
      </p>
    </div>
  );
}

/** "Máximo por pedido" and the total cap, when there is one. */
export function UnitsFields({ needsTotal, ...props }: UnitsFieldsProps) {
  const { form, errors, set } = props;
  return (
    <div className="flex flex-col gap-5">
      <MaxPerOrder {...props} />
      {!needsTotal && (
        <CheckboxField
          name="hasTotalCap"
          checked={form.hasTotalCap}
          onChange={(event) => set({ hasTotalCap: event.target.checked })}
        >
          <strong className="font-semibold">Poner un tope total de unidades</strong>
          <span className="block text-muted-foreground">
            Cuando se vendan, la promoción deja de aplicarse.
          </span>
        </CheckboxField>
      )}
      {(needsTotal || form.hasTotalCap) && (
        <TextField
          label="Tope total de unidades"
          name="totalUnits"
          inputMode="numeric"
          autoComplete="off"
          placeholder="Ej. 20"
          className="max-w-80"
          hint={TOTAL_HINT}
          value={form.totalUnits}
          error={errors.totalUnits}
          onChange={(event) => set({ totalUnits: event.target.value })}
        />
      )}
    </div>
  );
}
