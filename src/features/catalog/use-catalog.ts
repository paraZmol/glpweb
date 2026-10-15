import { listCatalog } from '../../data/products-repo';
import type { Product } from '../../domain/catalog/product';
import { type ReloadableResource, useAsyncResource } from '../../lib/use-async-resource';

/**
 * The whole catalogue of a distributor, withdrawn products included, in its order (PLAN 3.1):
 * for the panels of its staff (owner, dispatcher, driver; the owner and the dispatcher write).
 * Pass null while the distributor is not known. Call `reload()` after a write. Not live: one query per
 * load, one read per product (one for an empty catalogue) plus 1 by the rules.
 * `PermissionDeniedError` for an account that does not work there.
 */
export function useCatalog(distributorId: string | null): ReloadableResource<Product[]> {
  return useAsyncResource(distributorId && `catalog:${distributorId}`, () =>
    listCatalog(distributorId ?? ''),
  );
}
