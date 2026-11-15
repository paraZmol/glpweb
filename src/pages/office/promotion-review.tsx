import { InlineAlert } from '@/components/common/inline-alert';
import { ChargeWarning } from '@/components/promotions/charge-warning';
import { CustomerPreview } from '@/components/promotions/customer-preview';
import type { Product } from '@/domain/catalog/product';
import { type Promotion, promotionStateOf } from '@/domain/pricing/promotion';
import { THREE_FOR_TWO, type PromotionForm } from '@/features/promotions/promotion-templates';
import type { PromotionFormState } from './use-promotion-form';

const OVERLAP =
  'Ya hay una promoción activa o programada para este producto y esta forma de venta. El cliente verá solo la que le deja el menor precio.';
const PRICE_LOCK =
  'Mientras dure, no podrás subir el precio de lista de estos productos: así el precio de antes que ven tus clientes es el real.';

/** Whether another live or scheduled promotion names one of these products sold that way. */
function overlaps(form: PromotionForm, promotions: readonly Promotion[], now: Date): boolean {
  return promotions.some((promotion) => {
    const state = promotionStateOf(promotion, now);
    return (
      (state === 'live' || state === 'scheduled') &&
      promotion.saleMode === form.saleMode &&
      promotion.productIds.some((id) => form.productIds.includes(id))
    );
  });
}

type PromotionReviewProps = {
  state: PromotionFormState;
  form: PromotionForm;
  catalog: readonly Product[];
  promotions: readonly Promotion[];
};

/**
 * Step 3 of "Añadir promoción" (marketing §4): how the customer will see it, painted with the
 * card of the distributor's page, and what the owner stops charging, always above the buttons.
 */
export function PromotionReview({ state, form, catalog, promotions }: PromotionReviewProps) {
  const { deal, preview } = state;
  const rows = preview?.rows.filter((row) => row.discountCents > 0) ?? [];
  const top = rows[0];
  const product = top && catalog.find((item) => item.id === top.productId);
  const totalUnits =
    form.hasTotalCap && /^\d+$/.test(form.totalUnits.trim()) ? Number(form.totalUnits) : null;
  const isTwoForOne = deal?.type === 'buyXPayY' && deal.buyUnits === 2;

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-bold">Así lo verá tu cliente</h2>
      {deal && product && top ? (
        <CustomerPreview
          product={product}
          row={top}
          deal={deal}
          saleMode={form.saleMode}
          maxUnitsPerOrder={form.maxUnitsPerOrder}
          totalUnits={totalUnits}
          validity={state.validity}
          conditions={form.conditions}
        />
      ) : (
        <p className="rounded-lg bg-muted p-4 text-[0.9375rem] font-semibold text-muted-foreground">
          Elige un producto y una rebaja para ver cómo queda.
        </p>
      )}
      {state.window && state.window.startsAt !== 'now' && (
        <InlineAlert tone="info">Tus clientes la ven desde que empieza.</InlineAlert>
      )}
      {deal && preview && rows.length > 0 && (
        <ChargeWarning
          deal={deal}
          saleMode={form.saleMode}
          rows={rows}
          level={preview.level}
          products={catalog}
          totalUnits={totalUnits}
          currency={product?.currency ?? 'PEN'}
          acceptsRisk={form.acceptsRisk}
          onAcceptsRisk={(acceptsRisk) => state.set({ acceptsRisk })}
          riskError={state.errors.acceptsRisk}
          onSoften={
            isTwoForOne
              ? () => state.set({ ...THREE_FOR_TWO, maxUnitsPerOrder: THREE_FOR_TWO.buyUnits })
              : undefined
          }
        />
      )}
      {overlaps(form, promotions, state.now) && <InlineAlert tone="info">{OVERLAP}</InlineAlert>}
      <p className="text-sm text-muted-foreground">{PRICE_LOCK}</p>
    </div>
  );
}
