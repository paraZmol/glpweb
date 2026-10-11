import { approveListing, getListingReview } from '../../src/data/platform-repo';
import type { ReviewVersion } from '../../src/domain/tenancy/review-version';

/** A version no stored document can be at. */
export const NEVER_SEEN: ReviewVersion = { profile: 'never', settings: 'never' };

/**
 * Approves a listing the way the review screen does (PLAN 2.11): for the version of the data
 * read just before. For repository tests whose subject is something else than the review.
 */
export async function approveAsSeen(d: string, adminUid: string): Promise<boolean> {
  const seen = (await getListingReview(d))?.version ?? NEVER_SEEN;
  return approveListing({ d, adminUid, seen, now: new Date() });
}
