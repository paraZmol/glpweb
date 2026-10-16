import * as productsRepo from '../../data/products-repo';
import { moveInCatalog, sortCatalog } from '../../domain/catalog/catalog';
import { ProductNotFoundError } from '../../domain/catalog/errors';
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
 * Owner or dispatcher (PLAN 3.1; §11, 2026-10-15): adds a product, on sale unless
 * `input.active` is false, at the end of the list. Prices are integer cents (`parseMoneyCents`
 * reads what the person typed). Returns its id. Throws `InvalidInputError` (per-field issues;
 * `fullPriceCents: notAbove` when the full cylinder does not cost more than the refill),
 * `CatalogFullError`, `StaleCatalogError` (try again), `PermissionDeniedError` (a driver or
 * someone outside, or the distributor is read-only: suspended, payment pending, trial over) or
 * `OfflineError`.
 */
export async function addProduct(distributorId: string, input: ProductInput): Promise<string> {
  const prepared = prepareNewProduct(input);
  if (!prepared.ok) throw new InvalidInputError(prepared.issues);
  const id = await productsRepo.createProduct(distributorId, prepared.value);
  forgetVisibleDistributors();
  return id;
}

/**
 * Owner or dispatcher: edits `current` (as the screen has it) with `patch`. Weight and currency
 * cannot change: another weight is another product. Orders already made keep their prices (phase 4).
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
 * Owner or dispatcher: puts a product on sale or takes it off (customers stop seeing it; nothing is
 * deleted). Same errors as `editProduct`.
 */
export function setProductOnSale(
  distributorId: string,
  product: Product,
  isOnSale: boolean,
): Promise<void> {
  return editProduct(distributorId, product, { active: isOnSale });
}

/** What a move did, for the screen to say it. */
export interface MoveOutcome {
  /** 1-based place the product took, and of how many. */
  position: number;
  total: number;
  /**
   * The order on screen was not the stored one (somebody ordered the catalogue in another tab
   * or device): the step was taken on the stored order, and the screen should say so.
   */
  wasBehind: boolean;
}

function orderOf(products: readonly Pick<Product, 'id' | 'sortOrder'>[]): string {
  return sortCatalog(products)
    .map((product) => product.id)
    .join(',');
}

/**
 * Owner or dispatcher: moves `productId` one place up (`step` -1) or down (+1). The step is taken
 * on the catalogue as it is stored NOW, read again first, never on the order the screen shows:
 * a screen that is behind must not undo what another person ordered a moment before (PLAN §11,
 * 2026-10-15). Writes only the products whose position changes, in one batch.
 * Cost: the catalogue is read once more (one read per product) on top of `reorderProducts`.
 * Throws `ProductNotFoundError`, `StaleCatalogError` (it changed again between the two reads),
 * `PermissionDeniedError` or `OfflineError`.
 */
export async function moveProduct(
  distributorId: string,
  shown: readonly Product[],
  productId: string,
  step: -1 | 1,
): Promise<MoveOutcome> {
  const stored = sortCatalog(await productsRepo.listCatalog(distributorId));
  const from = stored.findIndex((product) => product.id === productId);
  if (from === -1) throw new ProductNotFoundError(productId);
  const to = Math.max(0, Math.min(from + step, stored.length - 1));
  await productsRepo.reorderProducts(distributorId, moveInCatalog(stored, productId, to));
  forgetVisibleDistributors();
  return { position: to + 1, total: stored.length, wasBehind: orderOf(shown) !== orderOf(stored) };
}
