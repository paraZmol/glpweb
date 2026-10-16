import { listCatalog } from '../../data/products-repo';
import type { Product } from '../../domain/catalog/product';
import { type ReloadableResource, useAsyncResource } from '../../lib/use-async-resource';
import { useRefreshOnReturn } from '../../lib/use-refresh-on-return';

/**
 * The whole catalogue of a distributor, withdrawn products included, in its order (PLAN 3.1):
 * for the panels of its staff (owner, dispatcher, driver; the owner and the dispatcher write).
 * Pass null while the distributor is not known. Call `reload()` after a write. Not live: it is
 * read when the screen opens and again each time the person comes back to it
 * (`useRefreshOnReturn`), so a change made in another tab or by somebody else shows on return.
 * Cost per load: one read per product (one for an empty catalogue) plus 1 by the rules.
 * `PermissionDeniedError` for an account that does not work there.
 */
export function useCatalog(distributorId: string | null): ReloadableResource<Product[]> {
  const catalog = useAsyncResource(distributorId && `catalog:${distributorId}`, () =>
    listCatalog(distributorId ?? ''),
  );
  useRefreshOnReturn(catalog.reload, distributorId !== null);
  return catalog;
}
