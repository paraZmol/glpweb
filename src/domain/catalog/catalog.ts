import { MAX_BRANDS } from '../tenancy/constants';
import { MAX_PRODUCTS, MAX_SORT_ORDER } from './constants';
import type { Product } from './product';

const SLOT_DIGITS = 2;

/** `p00` … `p29`: the fixed ids a catalogue may use (firebase/firestore.rules: `^p[0-2][0-9]$`). */
export const PRODUCT_SLOT_IDS: readonly string[] = Array.from(
  { length: MAX_PRODUCTS },
  (_, index) => `p${String(index).padStart(SLOT_DIGITS, '0')}`,
);

export function isProductSlot(id: string): boolean {
  return PRODUCT_SLOT_IDS.includes(id);
}

/** The first slot no product uses; null when the catalogue is full. */
export function freeProductSlot(products: readonly Pick<Product, 'id'>[]): string | null {
  const used = new Set(products.map((product) => product.id));
  return PRODUCT_SLOT_IDS.find((slot) => !used.has(slot)) ?? null;
}

/** The order the distributor chose; ties (which a reorder removes) by slot. */
export function sortCatalog<T extends Pick<Product, 'id' | 'sortOrder'>>(
  products: readonly T[],
): T[] {
  return [...products].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
}

/** Position for a product added now: after every other one. */
export function nextSortOrder(products: readonly Pick<Product, 'sortOrder'>[]): number {
  const last = Math.max(-1, ...products.map((product) => product.sortOrder));
  return Math.min(last + 1, MAX_SORT_ORDER);
}

/** The ids in the order that results from moving `id` to `toIndex` (clamped to the list). */
export function moveInCatalog(
  products: readonly Pick<Product, 'id' | 'sortOrder'>[],
  id: string,
  toIndex: number,
): string[] {
  const ids = sortCatalog(products).map((product) => product.id);
  const from = ids.indexOf(id);
  if (from === -1) return ids;
  ids.splice(from, 1);
  const to = Math.max(0, Math.min(toIndex, ids.length));
  ids.splice(to, 0, id);
  return ids;
}

export interface SortChange {
  id: string;
  sortOrder: number;
}

/**
 * The writes that leave the catalogue in the order of `orderedIds`: position = index, and only
 * for the products whose position changes. Null when `orderedIds` is not exactly the ids of the
 * catalogue (a product added or seen in another tab meanwhile): reload and ask again.
 */
export function planReorder(
  products: readonly Pick<Product, 'id' | 'sortOrder'>[],
  orderedIds: readonly string[],
): SortChange[] | null {
  const known = new Set(products.map((product) => product.id));
  const isPermutation =
    orderedIds.length === known.size &&
    new Set(orderedIds).size === orderedIds.length &&
    orderedIds.every((id) => known.has(id));
  if (!isPermutation) return null;
  const positionOf = new Map(products.map((product) => [product.id, product.sortOrder]));
  return orderedIds.flatMap((id, index) =>
    positionOf.get(id) === index ? [] : [{ id, sortOrder: index }],
  );
}

/**
 * What the public profile repeats of the catalogue for the search page: the gas brands on sale
 * (first appearance in the chosen order, at most `MAX_BRANDS`) and the cheapest refill on sale
 * ("Recarga desde S/ …", marketing H8: always a refill, never a full cylinder) with the weight
 * of that product, so the page can say "Recarga 10 kg desde S/ 48.00" (PLAN §11, 2026-10-15).
 * When several products share the cheapest refill, the first one in the chosen order names the
 * weight. Null and empty when nothing is on sale.
 */
export interface CatalogSummary {
  brands: string[];
  priceFromCents: number | null;
  priceFromWeightKg: number | null;
}

export type SummarizedProduct = Pick<
  Product,
  'id' | 'sortOrder' | 'active' | 'brand' | 'refillPriceCents' | 'weightKg'
>;

export function summarizeCatalog(products: readonly SummarizedProduct[]): CatalogSummary {
  const onSale = sortCatalog(products.filter((product) => product.active));
  const brands = [...new Set(onSale.map((product) => product.brand))].slice(0, MAX_BRANDS);
  const cheapest = onSale.reduce<SummarizedProduct | null>(
    (best, product) =>
      best === null || product.refillPriceCents < best.refillPriceCents ? product : best,
    null,
  );
  return {
    brands,
    priceFromCents: cheapest?.refillPriceCents ?? null,
    priceFromWeightKg: cheapest?.weightKg ?? null,
  };
}

/**
 * How the search page and the public page name the "desde" price: "Recarga 10 kg desde" with
 * the weight of that refill, or "Recarga desde" for a profile written before the weight existed
 * (PLAN §11, 2026-10-15; marketing H8).
 */
export function priceFromLabel(weightKg: number | null): string {
  return weightKg === null ? 'Recarga desde' : `Recarga ${weightKg} kg desde`;
}

/** A profile written before the weight existed has none: it differs from a summary with one. */
export function isSameSummary(a: CatalogSummary, b: CatalogSummary): boolean {
  return (
    a.priceFromCents === b.priceFromCents &&
    a.priceFromWeightKg === b.priceFromWeightKg &&
    a.brands.length === b.brands.length &&
    a.brands.every((brand, index) => brand === b.brands[index])
  );
}
