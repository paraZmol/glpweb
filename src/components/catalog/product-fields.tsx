import { CheckboxField } from '@/components/common/checkbox-field';
import { TextField } from '@/components/common/text-field';
import { defaultProductName } from '@/domain/catalog/product';
import type {
  ProductForm,
  ProductFormErrors,
  ProductFormField,
} from '@/features/catalog/product-form';
import { GasColorChoice } from './gas-color-choice';
import { FixedWeight, WeightChoice } from './weight-choice';

const WHOLE_NUMBER = /^\d+$/;

export type SetProductField = <F extends ProductFormField>(field: F, value: ProductForm[F]) => void;

type ProductFieldsProps = {
  form: ProductForm;
  errors: ProductFormErrors;
  set: SetProductField;
  /** Editing an existing product: its weight is shown, not offered. */
  fixedWeightKg?: number;
};

/** A price in soles: the keyboard of numbers with a decimal mark. */
const priceProps = { inputMode: 'decimal', autoComplete: 'off', placeholder: '0.00' } as const;

/**
 * The fields of a product (PLAN 3.1), in the order the owner thinks of it: which gas, which
 * weight, what it is called, and what each way of selling it costs. The texts that name the two
 * ways of selling are marketing's (docs/marketing/oferta-y-promociones.md §2.1).
 */
export function ProductFields({ form, errors, set, fixedWeightKg }: ProductFieldsProps) {
  const weight = WHOLE_NUMBER.test(form.weightKg.trim()) ? Number(form.weightKg) : null;
  const suggestedName = defaultProductName(weight ?? fixedWeightKg ?? 10);
  return (
    <div className="flex flex-col gap-6">
      <TextField
        label="Marca del gas"
        name="brand"
        autoComplete="off"
        placeholder="Por ejemplo, Marca Uno Premium"
        hint="Si vendes la misma marca con otra válvula, inclúyelo en el nombre: “Premium”."
        value={form.brand}
        error={errors.brand}
        onChange={(event) => set('brand', event.target.value)}
      />
      <GasColorChoice
        value={form.brandColor}
        error={errors.brandColor}
        onChange={(color) => set('brandColor', color)}
      />
      {fixedWeightKg === undefined ? (
        <WeightChoice
          value={form.weightKg}
          error={errors.weightKg}
          onChange={(value) => set('weightKg', value)}
        />
      ) : (
        <FixedWeight weightKg={fixedWeightKg} />
      )}
      <TextField
        label="Nombre (opcional)"
        name="name"
        autoComplete="off"
        placeholder={suggestedName}
        hint={`Si lo dejas vacío, se llama “${suggestedName}”.`}
        value={form.name}
        error={errors.name}
        onChange={(event) => set('name', event.target.value)}
      />
      <TextField
        {...priceProps}
        label="Precio de la recarga (S/)"
        name="refillPrice"
        hint="Precio final: lo que paga quien compra, con impuestos y el reparto en tu zona. Quien compra te entrega su balón vacío y recibe uno lleno. Escribe 38, 38.50 o 38,50."
        value={form.refillPrice}
        error={errors.refillPrice}
        onChange={(event) => set('refillPrice', event.target.value)}
      />
      <div className="flex flex-col gap-4 rounded-lg p-4 inset-ring-[1.5px] inset-ring-border">
        <CheckboxField
          name="sellsFull"
          checked={form.sellsFull}
          onChange={(event) => set('sellsFull', event.target.checked)}
        >
          <strong className="font-semibold">También vendo balón completo</strong>
          <span className="block text-muted-foreground">
            Gas + envase: quien compra se queda con el balón y no entrega vacío.
          </span>
        </CheckboxField>
        {form.sellsFull && (
          <TextField
            {...priceProps}
            label="Precio del balón completo (S/)"
            name="fullPrice"
            hint="Precio final: lo que paga quien compra, con impuestos y el reparto en tu zona. Incluye el envase, por eso cuesta más que la recarga."
            value={form.fullPrice}
            error={errors.fullPrice}
            onChange={(event) => set('fullPrice', event.target.value)}
          />
        )}
      </div>
    </div>
  );
}
