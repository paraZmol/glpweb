import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  type Transaction,
  where,
} from 'firebase/firestore';
import {
  type CatalogSummary,
  freeProductSlot,
  isSameSummary,
  nextSortOrder,
  planReorder,
  type SummarizedProduct,
  summarizeCatalog,
} from '../domain/catalog/catalog';
import { CATALOG_QUERY_LIMIT, MAX_PRODUCTS } from '../domain/catalog/constants';
import {
  CatalogFullError,
  ProductNotFoundError,
  StaleCatalogError,
} from '../domain/catalog/errors';
import type { NewProduct, Product, ProductPatch } from '../domain/catalog/product';
import { CorruptDocumentError } from '../domain/tenancy/errors';
import { productConverter, publicDistributorConverter } from './converters';
import { guarded } from './errors';
import { db } from './firebase';
import { paths } from './paths';

const catalogRef = (d: string) => collection(db, paths.products(d)).withConverter(productConverter);
const productRef = (d: string, slot: string) => doc(db, paths.product(d, slot));
const profileRef = (d: string) => doc(db, paths.distributor(d));

/**
 * The whole catalogue, withdrawn products included, in the order the distributor chose. Its
 * staff only (`PermissionDeniedError` for anybody else). One query: one read per product (one
 * for an empty catalogue) plus 1 by the rules (the member document).
 */
export function listCatalog(d: string): Promise<Product[]> {
  return guarded(async () => {
    const ordered = query(catalogRef(d), orderBy('sortOrder'), limit(CATALOG_QUERY_LIMIT));
    return (await getDocs(ordered)).docs.map((product) => product.data());
  });
}

/**
 * The products on sale, in the order the distributor chose: what `/d/{slug}` shows. Anyone may
 * read them while the distributor takes orders (the same flag that opens its public profile);
 * otherwise only its staff, and anybody else gets `PermissionDeniedError`. One query: one read
 * per product on sale (one when there is none) plus 1 by the rules (the public profile; the
 * member document instead for the staff of a distributor that does not take orders).
 * Composite index: products (active, sortOrder).
 */
export function listPublicCatalog(d: string): Promise<Product[]> {
  return guarded(async () => {
    const onSale = where('active', '==', true);
    const ordered = query(catalogRef(d), onSale, orderBy('sortOrder'), limit(CATALOG_QUERY_LIMIT));
    return (await getDocs(ordered)).docs.map((product) => product.data());
  });
}

/**
 * The profile repeats the brands on sale and the cheapest refill, with its weight, for the search
 * page ("Recarga 10 kg desde S/ 48.00", PLAN §11 2026-10-15). A write of
 * the catalogue brings them up to date in the same transaction, and only when they change: every
 * write of the profile moves its version (`updatedAt`), which a review of the platform names.
 * The rules cannot check that the copy is true (they cannot add up a collection): an owner who
 * writes the profile by hand can still put another "desde" there (PLAN §11, 2026-10-14).
 */
async function readProfileSummary(tx: Transaction, d: string) {
  const profile = (await tx.get(profileRef(d).withConverter(publicDistributorConverter))).data();
  if (!profile) throw new CorruptDocumentError(paths.distributor(d), 'it does not exist');
  return profile;
}

function writeSummary(
  tx: Transaction,
  d: string,
  stored: CatalogSummary,
  catalog: readonly SummarizedProduct[],
) {
  const summary = summarizeCatalog(catalog);
  if (isSameSummary(stored, summary)) return;
  tx.update(profileRef(d), { ...summary, updatedAt: serverTimestamp() });
}

/** The exact document the rules expect: nested values rebuilt, server time for the dates. */
function productDocument(product: NewProduct, currency: string, sortOrder: number) {
  return {
    brand: product.brand,
    brandColor: product.brandColor,
    weightKg: product.weightKg,
    name: product.name,
    refillPriceCents: product.refillPriceCents,
    fullPriceCents: product.fullPriceCents,
    currency,
    active: product.active,
    sortOrder,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

/**
 * Owner or dispatcher, while the distributor is writable: adds `product` (from `prepareNewProduct`) in
 * the first free slot, after every other product, in the currency of the distributor. Returns
 * its id. Throws `CatalogFullError` when the 30 slots are taken, `StaleCatalogError` when another
 * tab took the same slot meanwhile, `PermissionDeniedError` (a driver or someone outside, read-only distributor)
 * or `OfflineError` (it is not queued without a connection).
 * Cost: the catalogue (one read per product) + 2 reads + 1 write, and 1 more write when the
 * summary of the profile changes. The rules add 1 lookup for the list, up to 3 for the reads and
 * 3 for the writes.
 */
export async function createProduct(d: string, product: NewProduct): Promise<string> {
  const catalog = await listCatalog(d);
  const slot = freeProductSlot(catalog);
  if (slot === null) throw new CatalogFullError(MAX_PRODUCTS);
  const sortOrder = nextSortOrder(catalog);
  await guarded(() =>
    runTransaction(db, async (tx) => {
      const profile = await readProfileSummary(tx, d);
      if ((await tx.get(productRef(d, slot))).exists()) throw new StaleCatalogError();
      tx.set(productRef(d, slot), productDocument(product, profile.currency, sortOrder));
      writeSummary(tx, d, profile, [...catalog, { ...product, id: slot, sortOrder }]);
    }),
  );
  return slot;
}

/**
 * Owner or dispatcher, while the distributor is writable: writes `patch` (from `prepareProductEdit`,
 * only what changes, never empty) on product `productId`. Taking it off sale or back is a patch
 * of `active`. Throws `ProductNotFoundError`, `PermissionDeniedError` (also when the patch would
 * leave the full cylinder at or below the refill price stored by another tab meanwhile) or
 * `OfflineError`.
 * Cost: the catalogue (one read per product) + 2 reads + 1 write, and 1 more write when the
 * summary of the profile changes. The rules add 1 lookup for the list, up to 3 for the reads and
 * 2 for the writes.
 */
export async function updateProduct(
  d: string,
  productId: string,
  patch: ProductPatch,
): Promise<void> {
  const catalog = await listCatalog(d);
  if (!catalog.some((product) => product.id === productId)) {
    throw new ProductNotFoundError(productId);
  }
  await guarded(() =>
    runTransaction(db, async (tx) => {
      const profile = await readProfileSummary(tx, d);
      const current = (
        await tx.get(productRef(d, productId).withConverter(productConverter))
      ).data();
      if (!current) throw new ProductNotFoundError(productId);
      tx.update(productRef(d, productId), { ...patch, updatedAt: serverTimestamp() });
      const edited = { ...current, ...patch };
      const others = catalog.filter((product) => product.id !== productId);
      writeSummary(tx, d, profile, [...others, edited]);
    }),
  );
}

/**
 * Owner or dispatcher, while the distributor is writable: leaves the catalogue in the order of
 * `orderedIds`, which must name every product exactly once (`moveInCatalog` builds it). Writes
 * only the products whose position changes, all at once. Throws `StaleCatalogError` when the
 * ids are not those of the catalogue (it changed in another tab), `PermissionDeniedError` or
 * `OfflineError`.
 * Cost: the catalogue (one read per product) + 1 read + one write per product that moves (and
 * 1 when the order of the brands in the profile changes). The rules add 1 lookup for the list,
 * 1 for the read and 2 for the writes (the same member and control documents for all of them).
 */
export async function reorderProducts(d: string, orderedIds: readonly string[]): Promise<void> {
  const catalog = await listCatalog(d);
  const changes = planReorder(catalog, orderedIds);
  if (changes === null) throw new StaleCatalogError();
  if (changes.length === 0) return;
  const positionOf = new Map(changes.map((change) => [change.id, change.sortOrder]));
  const reordered = catalog.map((product) => ({
    ...product,
    sortOrder: positionOf.get(product.id) ?? product.sortOrder,
  }));
  await guarded(() =>
    runTransaction(db, async (tx) => {
      const profile = await readProfileSummary(tx, d);
      for (const { id, sortOrder } of changes) {
        tx.update(productRef(d, id), { sortOrder, updatedAt: serverTimestamp() });
      }
      writeSummary(tx, d, profile, reordered);
    }),
  );
}
