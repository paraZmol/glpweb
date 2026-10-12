/**
 * The two ways a cylinder is sold (decision of 2026-10-10, docs/marketing/oferta-y-promociones.md
 * §2): `refill` swaps the customer's empty cylinder for a full one; `full` sells the gas with
 * the cylinder itself. The catalogue of phase 3 gives each product a price for each.
 */
export const SALE_MODES = ['refill', 'full'] as const;
export type SaleMode = (typeof SALE_MODES)[number];

/** What a product card needs to show; the real catalogue type arrives with phase 3. */
export interface ProductOffer {
  weightKg: number;
  /** Gas brand of the cylinder, with its own colour (not the distributor's). */
  brandName: string;
  brandColor: string | null;
  refillPriceCents: number;
  /** Null when the distributor does not sell the cylinder itself for this product. */
  fullPriceCents: number | null;
  currency: string;
}

/** The mode a card may show: `full` only exists for a product that has that price. */
export function availableSaleMode(product: ProductOffer, wanted: SaleMode): SaleMode {
  return wanted === 'full' && product.fullPriceCents !== null ? 'full' : 'refill';
}

export function priceCentsOf(product: ProductOffer, mode: SaleMode): number {
  const shown = availableSaleMode(product, mode);
  return shown === 'full' && product.fullPriceCents !== null
    ? product.fullPriceCents
    : product.refillPriceCents;
}
