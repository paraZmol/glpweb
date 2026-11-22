import type { Product } from '../catalog/product';
import type { SaleMode } from '../catalog/sale-mode';
import { isLive, type Promotion, type PromotionDeal } from './promotion';

/** What the price of a line needs of a product. */
export type PricedProduct = Pick<
  Product,
  'id' | 'refillPriceCents' | 'fullPriceCents' | 'active' | 'promotedUntil'
>;

const PERCENT = 100;

/** The list price of one unit sold that way; null when the product is not sold that way. */
export function listPriceOf(product: PricedProduct, saleMode: SaleMode): number | null {
  return saleMode === 'full' ? product.fullPriceCents : product.refillPriceCents;
}

/**
 * Whether the price lock of the product reaches the end of the promotion (PLAN §11, 2026-10-16):
 * the batch that creates or extends a promotion raises `promotedUntil` of each product it covers.
 * A promotion without that mark (written by a modified client) does not apply: its "before"
 * could be raised meanwhile. The order rules of phase 4 repeat the check.
 */
export function isCoveredBy(product: PricedProduct, promotion: Pick<Promotion, 'endsAt'>): boolean {
  return (
    product.promotedUntil != null && product.promotedUntil.getTime() >= promotion.endsAt.getTime()
  );
}

/**
 * Price of one unit under a deal that prices units one by one, or null for "lleva X, paga Y"
 * (it prices groups). A percentage is rounded in favour of the customer: the discount of each
 * unit goes up to the next cent.
 */
export function unitPromoPriceCents(
  deal: PromotionDeal,
  product: PricedProduct,
  listPriceCents: number,
): number | null {
  switch (deal.type) {
    case 'fixedPrice':
      return deal.priceSource === 'refill' ? product.refillPriceCents : deal.priceCents;
    case 'percentOff':
      return listPriceCents - Math.ceil((listPriceCents * deal.percent) / PERCENT);
    case 'amountOff':
      return listPriceCents - deal.amountCents;
    case 'buyXPayY':
      return null;
  }
}

/**
 * Whether `promotion` lowers the price of `product` sold as `saleMode` at `now`: live, naming
 * that product and that way of selling, the product on sale that way and covered by the price
 * lock, and leaving a price below the list price and above zero (H2: never a fake discount,
 * never a free or negative unit, except the free ones of "lleva X, paga Y").
 */
export function appliesTo(
  promotion: Promotion,
  product: PricedProduct,
  saleMode: SaleMode,
  now: Date,
): boolean {
  const listPriceCents = listPriceOf(product, saleMode);
  if (listPriceCents === null || !product.active) return false;
  if (promotion.saleMode !== saleMode || !promotion.productIds.includes(product.id)) return false;
  if (!isLive(promotion, now) || !isCoveredBy(product, promotion)) return false;
  const unitPrice = unitPromoPriceCents(promotion.deal, product, listPriceCents);
  return unitPrice === null || (unitPrice >= 1 && unitPrice < listPriceCents);
}

export interface Discount {
  /** Units that take the promotion (the rest go at list price). */
  units: number;
  discountCents: number;
}

/**
 * The discount of `units` units at `listPriceCents` (a promotion that applies, see `appliesTo`).
 * "Lleva X, paga Y" counts only whole groups: the units that do not complete one are not in it.
 */
export function discountOf(
  deal: PromotionDeal,
  product: PricedProduct,
  listPriceCents: number,
  units: number,
): Discount {
  if (deal.type === 'buyXPayY') {
    const groups = Math.floor(units / deal.buyUnits);
    const freeUnits = groups * (deal.buyUnits - deal.payUnits);
    return { units: groups * deal.buyUnits, discountCents: freeUnits * listPriceCents };
  }
  const unitPrice = unitPromoPriceCents(deal, product, listPriceCents) ?? listPriceCents;
  return { units, discountCents: units * (listPriceCents - unitPrice) };
}
