import { listPublicCatalog } from '../../data/products-repo';
import type { Product } from '../../domain/catalog/product';
import { type ReloadableResource, useAsyncResource } from '../../lib/use-async-resource';

/**
 * The products on sale of a distributor, in its order: what `/d/{slug}` shows, with or without a
 * session (PLAN 3.1). Pass the id of the distributor `useDistributorBySlug` returned, or null
 * while there is none. An empty list means it has not published products yet
 * (`toProductOffer` turns each one into what the product card takes).
 * Not live: one query per load, one read per product on sale (one when there is none) plus 1 by
 * the rules (the public profile). For a visitor it fails with `PermissionDeniedError` when the
 * distributor does not take orders; the page already answers "no encontrada" before asking. Its
 * own staff gets the list either way.
 */
export function usePublicCatalog(distributorId: string | null): ReloadableResource<Product[]> {
  return useAsyncResource(distributorId && `public-catalog:${distributorId}`, () =>
    listPublicCatalog(distributorId ?? ''),
  );
}
