import * as platformRepo from '../../data/platform-repo';
import type { Session } from '../../domain/auth/session';
import { InvalidInputError } from '../../domain/tenancy/errors';
import { prepareReviewNote, statusAfterReactivation } from '../../domain/tenancy/listing';
import type { ReviewVersion } from '../../domain/tenancy/review-version';
import { forgetVisibleDistributors } from '../tenancy/visible-distributors';

// Operations of the platform panel (PLAN 2.11). Every one of them is for a platform admin: the
// security rules check it again, so an account that is not one gets `PermissionDeniedError`.
// They throw `OfflineError` without a connection (none of them can be queued).

export type {
  DistributorListRequest,
  DistributorPage,
  ListedDistributor,
  ListingReview,
  PageCursor,
  PendingListing,
} from '../../data/platform-repo';

/**
 * The listings that wait for a decision, oldest first: new distributors, and those whose owner
 * changed the name or a phone. Each entry is the control document (founder, status, trial end,
 * the note left before, if any, whether its owner answered it, and copies of the public name
 * and link); read `getListingReview` for the rest.
 * Cost: one read per listing (minimum one), at most `PENDING_LISTINGS_LIMIT`.
 */
export const listPendingListings = platformRepo.listPendingListings;

/**
 * One page of the distributors in a given standing (`inReview`, `approved` or `suspended`),
 * oldest first: how the panel reaches a distributor that is already approved or suspended.
 * Pass `after: page.next` for the following page. Cost: one read per row plus one, per page.
 */
export const listDistributors = platformRepo.listDistributors;

/**
 * Everything to decide on one listing: what visitors will see, where it stands, and what the
 * founder declared (RUC, legal name, record number of the Registro de Hidrocarburos, contact).
 * Null when the distributor does not exist. Cost: 3 reads, plus up to 4 by the rules.
 * `review.version` says which version of the data it is: hand it to `approveDistributor`.
 */
export const getListingReview = platformRepo.getListingReview;

/**
 * The same, live: `onChange` runs with the review (or null) now and whenever its owner or the
 * platform changes one of the three documents. Returns how to stop; `useListingReview` wraps it.
 */
export const watchListingReview = platformRepo.watchListingReview;

/**
 * Approves a listing: the distributor becomes visible if it may operate. The approval is signed
 * with the admin's own account and server time, and it is for the data the admin looked at:
 * `seen` is the `version` of the review that was on screen. If the public profile or the private
 * settings changed since, nothing is approved and it throws `StaleReviewError`: show the new
 * data and let the admin decide again. Resolves to false when the distributor does not exist.
 * IT SAYS ONLY THAT THE PLATFORM LOOKED AT WHAT WAS DECLARED: screens must never present the
 * distributor as "verificada".
 */
export async function approveDistributor(
  admin: Session,
  distributorId: string,
  seen: ReviewVersion,
): Promise<boolean> {
  const request = { d: distributorId, adminUid: admin.uid, seen, now: new Date() };
  const found = await platformRepo.approveListing(request);
  forgetVisibleDistributors();
  return found;
}

/**
 * Sends a listing back to its owner: a refusal of a new one, or an approval that is withdrawn.
 * The distributor leaves the search and its page closes to visitors. `note` is what the owner
 * reads in its panel (optional; trimmed; `InvalidInputError` on `reviewNote` when too long).
 */
export async function returnDistributorToReview(distributorId: string, note = ''): Promise<void> {
  const prepared = prepareReviewNote(note);
  if (!prepared.ok) throw new InvalidInputError(prepared.issues);
  await platformRepo.returnListingToReview(distributorId, prepared.value);
  forgetVisibleDistributors();
}

/**
 * Suspends a distributor: it becomes read-only for its staff, leaves the search, and its page,
 * name and phones stop being readable by visitors. The approval of its listing is kept, so
 * reactivating it shows it again. Resolves to false when it does not exist.
 */
export async function suspendDistributor(distributorId: string): Promise<boolean> {
  const found = await platformRepo.setDistributorStatus(distributorId, 'suspended', new Date());
  forgetVisibleDistributors();
  return found;
}

/**
 * Lifts a suspension (or a "past due"): back on its trial while the trial still runs, otherwise
 * `active`. It is listed again only if its listing is approved. Resolves to false when it does
 * not exist.
 */
export async function reactivateDistributor(distributorId: string): Promise<boolean> {
  const now = new Date();
  const found = await platformRepo.setDistributorStatus(
    distributorId,
    (control) => statusAfterReactivation(control, now),
    now,
  );
  forgetVisibleDistributors();
  return found;
}
