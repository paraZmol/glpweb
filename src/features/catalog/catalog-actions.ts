import * as productsRepo from '../../data/products-repo';
import { moveInCatalog } from '../../domain/catalog/catalog';
import type { Product, ProductPatch } from '../../domain/catalog/product';
import {
  prepareNewProduct,
  prepareProductEdit,
  type ProductInput,
} from '../../domain/catalog/product-input';
import { InvalidInputError, NothingChangedError } from '../../domain/tenancy/errors';
import { forgetVisibleDistributors } from '../tenancy/visible-distributors';

// Every write of the catalogue may change the brands and the "desde" price the search page
// shows, so each one forgets the cached search list.

/**
 * Owner only (PLAN 3.1): adds a product, on sale unless `input.active` is false, at the end of
 * the list. Prices are integer cents (`parseMoneyCents` reads what the person typed). Returns its
 * id. Throws `InvalidInputError` (per-field issues; `fullPriceCents: notAbove` when the full
 * cylinder does not cost more than the refill), `CatalogFullError`, `StaleCatalogError` (try
 * again), `PermissionDeniedError` (not an owner, or the distributor is read-only: suspended,
 * payment pending, trial over) or `OfflineError`.
 */
export async function addProduct(distributorId: string, input: ProductInput): Promise<string> {
  const prepared = prepareNewProduct(input);
  if (!prepared.ok) throw new InvalidInputError(prepared.issues);
  const id = await productsRepo.createProduct(distributorId, prepared.value);
  forgetVisibleDistributors();
  return id;
}

/**
 * Owner only: edits `current` (as the screen has it) with `patch`. Weight and currency cannot
 * change: another weight is another product. Orders already made keep their prices (phase 4).
 * Throws `InvalidInputError`, `NothingChangedError` (nothing was written), `ProductNotFoundError`,
 * `PermissionDeniedError` or `OfflineError`.
 */
export async function editProduct(
  distributorId: string,
  current: Product,
  patch: ProductPatch,
): Promise<void> {
  const prepared = prepareProductEdit(current, patch);
  if (!prepared.ok) throw new InvalidInputError(prepared.issues);
  if (Object.keys(prepared.value).length === 0) throw new NothingChangedError();
  await productsRepo.updateProduct(distributorId, current.id, prepared.value);
  forgetVisibleDistributors();
}

/**
 * Owner only: puts a product on sale or takes it off (customers stop seeing it; nothing is
 * deleted). Same errors as `editProduct`.
 */
export function setProductOnSale(
  distributorId: string,
  product: Product,
  isOnSale: boolean,
): Promise<void> {
  return editProduct(distributorId, product, { active: isOnSale });
}

/**
 * Owner only: moves `productId` to position `toIndex` of `catalog` (the list as the screen shows
 * it; clamped to its ends). Writes only the products whose position changes, in one batch.
 * Throws `StaleCatalogError` when the catalogue changed in another tab (reload it),
 * `PermissionDeniedError` or `OfflineError`.
 */
export async function moveProduct(
  distributorId: string,
  catalog: readonly Product[],
  productId: string,
  toIndex: number,
): Promise<void> {
  await productsRepo.reorderProducts(distributorId, moveInCatalog(catalog, productId, toIndex));
  forgetVisibleDistributors();
}
