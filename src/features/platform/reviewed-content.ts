import type { DistributorControl } from '../../domain/tenancy/types';
import type { ListingReview } from './platform-actions';

/**
 * Everything of a listing a platform admin compares before approving (PLAN 2.11), as one text:
 * the whole public profile and the whole private settings, minus the two fields that move
 * without anybody editing the listing — the stamp of the last write and the "takes orders"
 * flag, which follows the control document. Two reviews with the same text show the admin the
 * same thing. Opaque: only compare it (`useReviewAttention`).
 */
export function reviewedContentOf({ profile, settings }: ListingReview): string {
  const { updatedAt: _profileStamp, acceptingOrders: _derived, ...shownProfile } = profile;
  const { updatedAt: _settingsStamp, ...shownSettings } = settings;
  return JSON.stringify([shownProfile, shownSettings]);
}

/** Where a distributor stands with the platform: what a decision of an admin changes. */
export type Standing = Pick<DistributorControl, 'status' | 'listingApproved'>;

export function standingOf({ status, listingApproved }: Standing): Standing {
  return { status, listingApproved };
}

export function isSameStanding(one: Standing, other: Standing): boolean {
  return one.status === other.status && one.listingApproved === other.listingApproved;
}
