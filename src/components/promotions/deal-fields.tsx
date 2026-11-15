import { useId } from 'react';
import { CHIP_CLASS } from '@/components/catalog/weight-choice';
import { FieldError, TextField } from '@/components/common/text-field';
import { ChipsWithOther } from './chips-with-other';
import { BUY_X_PAY_Y_OPTIONS } from '@/domain/pricing/constants';
import type { PromotionForm } from '@/features/promotions/promotion-templates';

const AMOUNT_CHIPS = ['2', '3', '5', '10'] as const;
const PERCENT_CHIPS = ['5', '10', '15', '20'] as const;

type DealFieldsProps = {
  form: PromotionForm;
  /** "Precio de lista: S/ 52.00", for the special price. */
  listPriceText: string | null;
  error?: string;
  set: (patch: Partial<PromotionForm>) => void;
};

/** "El número" of marketing §4, step 2: what each template asks for, and nothing for P3. */
export function DealFields({ form, listPriceText, error, set }: DealFieldsProps) {
  const labelId = useId();
  switch (form.template) {
    case 'specialPrice':
    case 'fullDiscount':
      return (
        <TextField
          label="Precio especial (S/)"
          name="price"
          inputMode="decimal"
          autoComplete="off"
          className="max-w-60"
          hint={listPriceText ?? undefined}
          value={form.price}
          error={error}
          onChange={(event) => set({ price: event.target.value })}
        />
      );
    case 'amountOff':
      return (
        <ChipsWithOther
          label="¿Cuántos soles menos?"
          chips={AMOUNT_CHIPS}
          chipText={(chip) => `S/ ${chip}`}
          value={form.amount}
          otherLabel="Soles de rebaja"
          error={error}
          onChange={(amount) => set({ amount })}
        />
      );
    case 'percentOff':
      return (
        <ChipsWithOther
          label="¿Qué porcentaje?"
          chips={PERCENT_CHIPS}
          chipText={(chip) => `${chip} %`}
          value={form.percent}
          otherLabel="Porcentaje (hasta 30)"
          error={error}
          onChange={(percent) => set({ percent })}
        />
      );
    case 'fullAtRefill':
      return (
        <p className="rounded-lg bg-muted p-3.5 text-[0.9375rem] font-semibold">
          El balón completo se cobra al precio de la recarga de hoy: quien compra se lleva el envase
          sin pagarlo.
        </p>
      );
    case 'buyXPayY':
      return (
        <div>
          <p id={labelId} className="mb-1.5 text-[0.9375rem] font-semibold">
            ¿Cuántos lleva y cuántos paga?
          </p>
          <div role="radiogroup" aria-labelledby={labelId} className="flex flex-wrap gap-2">
            {BUY_X_PAY_Y_OPTIONS.map(({ buyUnits, payUnits }) => (
              <button
                key={buyUnits}
                type="button"
                role="radio"
                aria-checked={form.buyUnits === buyUnits}
                onClick={() => set({ buyUnits, payUnits, maxUnitsPerOrder: buyUnits })}
                className={CHIP_CLASS}
              >
                Lleva {buyUnits}, paga {payUnits}
              </button>
            ))}
          </div>
          {error && <FieldError id={`${labelId}-error`}>{error}</FieldError>}
        </div>
      );
  }
}
