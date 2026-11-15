import { GasBrandTheme } from '@/components/brand/brand-theme';
import { GasCylinder } from '@/components/brand/gas-cylinder';
import { SALE_MODE_NAMES } from '@/components/catalog/sale-mode-selector';
import type { Product } from '@/domain/catalog/product';
import type { SaleMode } from '@/domain/catalog/sale-mode';
import { formatMoney } from '@/domain/money/format';
import type { PreviewRow } from '@/domain/pricing/preview';
import { type PromotionDeal, promotionBadge } from '@/domain/pricing/promotion';
import { maxPerOrderText } from '@/features/promotions/promotion-texts';
import { PromotionBadge } from './promotion-card';

const CYLINDER_HEIGHT_PX = 92;
const NO_ACCESSORIES = 'No incluye regulador ni manguera.';

type CustomerPreviewProps = {
  product: Product;
  row: PreviewRow;
  deal: PromotionDeal;
  saleMode: SaleMode;
  maxUnitsPerOrder: number;
  totalUnits: number | null;
  /** "Hasta el domingo 18 de octubre, 8:00 p. m." (`describeValidity`); null while unknown. */
  validity: string | null;
  conditions: string;
};

/**
 * "Así lo verá tu cliente" (marketing §4, step 3): the product card of the distributor's page
 * with the promotion on it — the seal the system sets, the list price struck through (the real
 * one, H2), the saving in soles, the cap, the dates and the conditions, whole (H3, H4).
 */
export function CustomerPreview(props: CustomerPreviewProps) {
  const { product, row, deal, saleMode, maxUnitsPerOrder, totalUnits, validity, conditions } =
    props;
  const money = (cents: number) => formatMoney(cents, product.currency);
  const isGroup = deal.type === 'buyXPayY';
  const isPercent = deal.type === 'percentOff';
  const facts = [
    maxPerOrderText(maxUnitsPerOrder),
    totalUnits !== null && `Quedan ${totalUnits}`,
    validity,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <GasBrandTheme color={product.brandColor}>
      <article className="flex gap-3 rounded-xl bg-card p-3 shadow-card">
        <div className="grid w-22 shrink-0 place-items-end justify-center self-start rounded-[1.25rem] bg-gas-brand-soft pt-2 pb-1">
          <GasCylinder weightKg={product.weightKg} height={CYLINDER_HEIGHT_PX} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col items-start gap-1.5">
          <PromotionBadge>{promotionBadge(deal, product.currency)}</PromotionBadge>
          <div>
            <h3 className="text-xl font-bold">{product.name}</h3>
            <p className="flex items-center gap-1.5 text-[0.9375rem] font-semibold text-muted-foreground">
              <span aria-hidden="true" className="size-2.5 rounded-full bg-gas-brand" />
              {product.brand}
            </p>
          </div>
          <p className="flex flex-wrap items-baseline gap-x-2 tabular-nums">
            <span className="text-[0.8125rem] font-bold">{SALE_MODE_NAMES[saleMode]}</span>
            {isGroup ? (
              <span className="font-heading text-2xl font-extrabold">
                {money(row.listPriceCents)}
              </span>
            ) : (
              <>
                <s className="text-muted-foreground">
                  <span className="sr-only">Antes </span>
                  {money(row.listPriceCents)}
                </s>
                <span className="font-heading text-2xl font-extrabold">
                  {money(row.promoTotalCents)}
                </span>
              </>
            )}
          </p>
          <p className="text-[0.9375rem] font-semibold">
            {isGroup
              ? `Lleva ${row.units}, paga ${deal.payUnits}`
              : `Ahorras ${money(row.discountCents)}${isPercent ? ` (${deal.percent} %)` : ''}`}
          </p>
          {deal.type === 'fixedPrice' && deal.priceSource === 'refill' && (
            <p className="text-sm">Llévate el envase y paga solo el gas.</p>
          )}
          <p className="text-sm text-muted-foreground tabular-nums">{facts}</p>
          {conditions.trim() && <p className="text-sm wrap-anywhere">{conditions.trim()}</p>}
          {saleMode === 'full' && <p className="text-sm text-muted-foreground">{NO_ACCESSORIES}</p>}
        </div>
      </article>
    </GasBrandTheme>
  );
}
