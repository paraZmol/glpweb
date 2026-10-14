import type { ProductOffer } from './sale-mode';

/**
 * One cylinder a distributor sells, stored at `/distributors/{d}/products/{slot}` (PLAN 3.1).
 * Brand, weight, names and prices are data of each distributor: nothing here is tied to a
 * company. Money is integer cents in the distributor's currency.
 *
 * Two ways to sell it (docs/marketing/oferta-y-promociones.md §2): `refill` is always offered;
 * `full` (gas + cylinder) only when `fullPriceCents` is not null. A full cylinder always costs
 * more than a refill: it is the same gas plus the cylinder.
 *
 * Orders (phase 4) copy what they need of a product into each line — prices included — and
 * never read it again: editing or deactivating a product never changes an order already made.
 */
export interface Product {
  /** Slot id, `p00` … `p29` (see `MAX_PRODUCTS`). */
  id: string;
  /** Gas brand, as the distributor writes it ("Marca Uno Premium": the valve type goes here, D8). */
  brand: string;
  /** Colour of the gas brand for the dot of the card; null paints the neutral one. */
  brandColor: string | null;
  /** Fixed once created: another weight is another product (its plant stock is counted apart). */
  weightKg: number;
  /** Visible name without the brand: "Balón 10 kg" by default. */
  name: string;
  refillPriceCents: number;
  /** Null when the distributor does not sell this cylinder with its container. */
  fullPriceCents: number | null;
  /** Always the currency of the distributor (the rules compare them); immutable. */
  currency: string;
  /** Inactive products stay for the history but no customer sees or orders them. */
  active: boolean;
  /** Position chosen by the distributor; lower first. */
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

/** What the owner may change in an existing product. Weight and currency are fixed. */
export const EDITABLE_PRODUCT_FIELDS = [
  'brand',
  'brandColor',
  'name',
  'refillPriceCents',
  'fullPriceCents',
  'active',
] as const satisfies readonly (keyof Product)[];

export type ProductPatch = Partial<Pick<Product, (typeof EDITABLE_PRODUCT_FIELDS)[number]>>;

/** A product as the owner defines it; the repository adds slot, currency and position. */
export type NewProduct = Pick<
  Product,
  'brand' | 'brandColor' | 'weightKg' | 'name' | 'refillPriceCents' | 'fullPriceCents' | 'active'
>;

/** Name a product gets when the owner leaves it blank: "Balón 10 kg". */
export function defaultProductName(weightKg: number): string {
  return `Balón ${weightKg} kg`;
}

/** How a line names the product everywhere (marketing §2.1): "Balón 10 kg · Marca Uno". */
export function productTitle(product: Pick<Product, 'name' | 'brand'>): string {
  return `${product.name} · ${product.brand}`;
}

/** Whether the distributor sells this product with its container ("Balón completo"). */
export function sellsFullCylinder(product: Pick<Product, 'fullPriceCents'>): boolean {
  return product.fullPriceCents !== null;
}

/** What the product card of the public page needs. */
export function toProductOffer(product: Product): ProductOffer {
  return {
    weightKg: product.weightKg,
    name: product.name,
    brandName: product.brand,
    brandColor: product.brandColor,
    refillPriceCents: product.refillPriceCents,
    fullPriceCents: product.fullPriceCents,
    currency: product.currency,
  };
}

/**
 * Whether going from `before` to `after` raises a list price (PLAN 3.5, marketing §5.2): while
 * a promotion is active or scheduled on a product its list price may not go up, or the "before"
 * the customer sees would be inflated. Starting to sell the full cylinder is not a raise: no
 * promotion can exist on a way of selling that did not exist.
 */
export function raisesListPrice(
  before: Pick<Product, 'refillPriceCents' | 'fullPriceCents'>,
  after: Pick<Product, 'refillPriceCents' | 'fullPriceCents'>,
): boolean {
  if (after.refillPriceCents > before.refillPriceCents) return true;
  if (before.fullPriceCents === null || after.fullPriceCents === null) return false;
  return after.fullPriceCents > before.fullPriceCents;
}
