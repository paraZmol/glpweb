import type { ReloadableResource } from '../../lib/use-async-resource';
import { useLiveResource } from '../../lib/use-live-resource';
import { type ListingReview, watchListingReview } from './platform-actions';

/**
 * One listing with everything a platform admin looks at (public profile, control document and
 * what the founder declared), LIVE while the screen is open: an edit of its owner shows at once
 * (PLAN 2.11). `data` is null when the distributor does not exist; pass null to listen to
 * nothing (no listing selected). The lists of the panel are `usePlatformDistributors`.
 * `data.version` is what `useReviewAttention` and the approval work with.
 * Three listeners on single documents, closed when the screen leaves or another listing is
 * chosen. Cost: 3 reads (plus up to 4 by the rules) when it opens, then one per document that
 * changes. Opening a control document older than the copies of the public name and link does
 * not repair it: the next decision on it does.
 */
export function useListingReview(
  distributorId: string | null,
): ReloadableResource<ListingReview | null> {
  return useLiveResource(distributorId, (emit, fail) =>
    watchListingReview(distributorId ?? '', emit, fail),
  );
}
