import { type ReloadableResource, useAsyncResource } from '../../lib/use-async-resource';
import { useSignedInSession } from '../auth/use-session';
import {
  getListingReview,
  type ListingReview,
  listPendingListings,
  type PendingListing,
} from './platform-actions';

/**
 * The listings that wait for the review of the platform, oldest first (PLAN 2.11). For the
 * platform panel only: any other account gets an error (`PermissionDeniedError`). `idle` when
 * signed out. One bounded query per load, no listener; call `reload()` after a decision.
 */
export function usePendingListings(): ReloadableResource<PendingListing[]> {
  const uid = useSignedInSession()?.uid ?? null;
  return useAsyncResource(uid, () => listPendingListings());
}

/**
 * One listing with everything a platform admin looks at (public profile, control document and
 * what the founder declared). `data` is null when the distributor does not exist; pass null to
 * load nothing (no listing selected).
 */
export function useListingReview(
  distributorId: string | null,
): ReloadableResource<ListingReview | null> {
  return useAsyncResource(distributorId, () =>
    distributorId === null ? Promise.resolve(null) : getListingReview(distributorId),
  );
}
