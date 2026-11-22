import type { Product } from '../catalog/product';
import type { SaleMode } from '../catalog/sale-mode';
import { ATTENTION_ABOVE_PERCENT, RISK_ABOVE_PERCENT } from './constants';
import { discountOf, listPriceOf } from './discount';
import type { PromotionDeal } from './promotion';

/** How loud the warning of what the owner stops charging is (marketing §4, step 3). */
export type PreviewLevel = 'normal' | 'attention' | 'risk';

/** One product of the preview: "Balón 10 kg Marca Uno: S/ 52.00 → S/ 48.00". */
export interface PreviewRow {
  productId: string;
  listPriceCents: number;
  /**
   * What the units of one group cost with the promotion: one unit, or the X units of
   * "lleva X, paga Y" (`units` says how many).
   */
  promoTotalCents: number;
  units: number;
  /** What the owner stops charging for those units. */
  discountCents: number;
  /** Share of the list price, in whole percent rounded up (never understated). */
  percent: number;
  level: PreviewLevel;
}

const PERCENT = 100;

function levelOf(deal: PromotionDeal, percent: number): PreviewLevel {
  const givesContainer = deal.type === 'fixedPrice' && deal.priceSource === 'refill';
  const twoForOne = deal.type === 'buyXPayY' && deal.buyUnits === 2 && deal.payUnits === 1;
  if (givesContainer || twoForOne || percent > RISK_ABOVE_PERCENT) return 'risk';
  return percent > ATTENTION_ABOVE_PERCENT ? 'attention' : 'normal';
}

function rowOf(deal: PromotionDeal, product: Product, saleMode: SaleMode): PreviewRow | null {
  const listPriceCents = listPriceOf(product, saleMode);
  if (listPriceCents === null) return null;
  const units = deal.type === 'buyXPayY' ? deal.buyUnits : 1;
  const { discountCents } = discountOf(deal, product, listPriceCents, units);
  const fullCents = units * listPriceCents;
  const percent = Math.ceil((discountCents * PERCENT) / fullCents);
  return {
    productId: product.id,
    listPriceCents,
    promoTotalCents: fullCents - discountCents,
    units,
    discountCents,
    percent,
    level: levelOf(deal, percent),
  };
}

/**
 * "Así lo verá tu cliente" and "Dejas de cobrar…" (marketing §4, step 3): a row for each chosen
 * product sold that way, the largest discount first. The system knows no costs, so it speaks of
 * what is no longer charged, never of profit. `level` of the whole promotion is its loudest row.
 */
export function previewPromotion(
  deal: PromotionDeal,
  products: readonly Product[],
  saleMode: SaleMode,
): { rows: PreviewRow[]; level: PreviewLevel } {
  const rows = products
    .map((product) => rowOf(deal, product, saleMode))
    .filter((row): row is PreviewRow => row !== null)
    .sort((a, b) => b.discountCents - a.discountCents || a.productId.localeCompare(b.productId));
  const levels: PreviewLevel[] = ['normal', 'attention', 'risk'];
  const level = levels[Math.max(0, ...rows.map((row) => levels.indexOf(row.level)))] ?? 'normal';
  return { rows, level };
}
