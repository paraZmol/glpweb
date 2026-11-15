import { DealFields } from '@/components/promotions/deal-fields';
import { ProductPick, SaleModeChips } from '@/components/promotions/product-pick';
import { UnitsFields } from '@/components/promotions/units-fields';
import { ValidityChoice } from '@/components/promotions/validity-choice';
import { FieldError, TextField } from '@/components/common/text-field';
import { formatMoney } from '@/domain/money/format';
import { listPriceOf } from '@/domain/pricing/discount';
import { needsTotalCap } from '@/domain/pricing/deal-checks';
import {
  PROMOTION_CONDITIONS_MAX_LENGTH,
  PROMOTION_TITLE_MAX_LENGTH,
} from '@/domain/pricing/constants';
import {
  FIXED_SALE_MODE,
  isSingleProduct,
  type PromotionForm,
} from '@/features/promotions/promotion-templates';
import type { PromotionFormState } from './use-promotion-form';

/** "Precio de lista: S/ 52.00", of the product a special price is for. */
function listPriceText(state: PromotionFormState): string | null {
  const product = state.chosen[0];
  const price = product && state.form && listPriceOf(product, state.form.saleMode);
  return product && price != null
    ? `Precio de lista: ${formatMoney(price, product.currency)}. El especial debe ser menor.`
    : null;
}

/**
 * Step 2 of "Añadir promoción" (marketing §4), in its order: products, way of selling, the
 * number, the dates, the caps, the name and the conditions. Chips, cards and +/−; no drop-downs.
 */
export function PromotionFields({
  state,
  form,
}: {
  state: PromotionFormState;
  form: PromotionForm;
}) {
  const { errors, set } = state;
  const isFixedMode = FIXED_SALE_MODE[form.template] !== undefined;
  const deal = state.deal;
  const isBuy = form.template === 'buyXPayY';

  return (
    <div className="flex flex-col gap-7">
      {!isFixedMode && (
        <SaleModeChips value={form.saleMode} onChange={(saleMode) => set({ saleMode })} />
      )}
      {errors.saleMode && <FieldError id="promotion-sale-mode-error">{errors.saleMode}</FieldError>}
      <ProductPick
        products={state.eligible}
        saleMode={form.saleMode}
        value={form.productIds}
        isSingle={isSingleProduct(form.template)}
        error={errors.productIds}
        onChange={(productIds) => set({ productIds })}
      />
      <DealFields form={form} listPriceText={listPriceText(state)} error={errors.deal} set={set} />
      <ValidityChoice
        form={form}
        window={state.window}
        limits={state.limits}
        error={errors.validity}
        set={set}
      />
      <UnitsFields
        form={form}
        step={isBuy ? form.buyUnits : 1}
        isFixed={form.template === 'fullAtRefill'}
        needsTotal={deal ? needsTotalCap(deal) : false}
        errors={errors}
        set={set}
      />
      <TextField
        label="Nombre"
        name="title"
        autoComplete="off"
        maxLength={PROMOTION_TITLE_MAX_LENGTH}
        hint="Lo ven tus clientes junto al precio."
        value={form.title}
        error={errors.title}
        onChange={(event) => set({ title: event.target.value })}
      />
      <TextField
        label="Condiciones (opcional)"
        name="conditions"
        autoComplete="off"
        maxLength={PROMOTION_CONDITIONS_MAX_LENGTH}
        hint="Lo que el cliente debe saber. Por ejemplo: Solo pedidos por Hornilla."
        value={form.conditions}
        error={errors.conditions}
        onChange={(event) => set({ conditions: event.target.value })}
      />
    </div>
  );
}
