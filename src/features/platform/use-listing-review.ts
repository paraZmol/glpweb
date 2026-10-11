import { type ReloadableResource, useAsyncResource } from '../../lib/use-async-resource';
import { getListingReview, type ListingReview } from './platform-actions';

/**
 * One listing with everything a platform admin looks at (public profile, control document and
 * what the founder declared). `data` is null when the distributor does not exist; pass null to
 * load nothing (no listing selected). The lists of the panel are `usePlatformDistributors`.
 * Opening a control document older than the copies of the public name and link does not repair
 * it: the next decision on it does.
 */
export function useListingReview(
  distributorId: string | null,
): ReloadableResource<ListingReview | null> {
  return useAsyncResource(distributorId, () =>
    distributorId === null ? Promise.resolve(null) : getListingReview(distributorId),
  );
}
