import { REVIEW_NOTE_MAX_LENGTH } from './constants';
import { checkText, type Validated } from './field-checks';
import { isWritable } from './status';
import type { DistributorControl, DistributorStatus } from './types';

type ListingInput = Pick<DistributorControl, 'status' | 'trialEndsAt' | 'listingApproved'>;

/**
 * The value the public `acceptingOrders` flag must carry (PLAN 2.11): the distributor may
 * operate AND a platform admin approved its listing. It is also what makes the public profile
 * readable by visitors. firebase/firestore.rules repeats it (`isOpenData`).
 */
export function isOpenToPublic(control: ListingInput, now: Date): boolean {
  return control.listingApproved && isWritable(control, now);
}

/**
 * Where a distributor stands with the review of its listing, for its own panel:
 * - `inReview`: waiting for a platform admin (a new one, or one that changed its name or phones);
 * - `changesRequested`: sent back with a note the owner should read;
 * - `listed`: approved and operating, so visitors see it;
 * - `notOperating`: approved, but suspended, past due or with the trial over.
 */
export type ListingState = 'inReview' | 'changesRequested' | 'listed' | 'notOperating';

export function listingStateOf(
  control: ListingInput & Pick<DistributorControl, 'reviewNote'>,
  now: Date,
): ListingState {
  if (!control.listingApproved) return control.reviewNote ? 'changesRequested' : 'inReview';
  return isWritable(control, now) ? 'listed' : 'notOperating';
}

/**
 * What a customer uses to recognise and reach the business. Changing any of them after the
 * approval sends the listing back to review: otherwise an approved distributor could turn into
 * somebody else overnight. The rules hold the same list.
 */
export const IDENTITY_FIELDS = ['name', 'contactPhone', 'whatsapp'] as const;

export function touchesIdentity(patch: object): boolean {
  return IDENTITY_FIELDS.some((field) => field in patch);
}

/**
 * An account whose distributor is read-only (suspended, past due or with the trial over) cannot
 * found another one: a new one would be thirty fresh days of trial. A distributor that is only
 * waiting for its review does not block.
 */
export function hasReadOnlyDistributor(
  controls: readonly Pick<DistributorControl, 'status' | 'trialEndsAt'>[],
  now: Date,
): boolean {
  return controls.some((control) => !isWritable(control, now));
}

/**
 * The status a suspended or past-due distributor returns to when a platform admin reactivates
 * it: back on its trial while the trial still runs, otherwise `active` (the admin is saying it
 * is in good standing).
 */
export function statusAfterReactivation(
  control: Pick<DistributorControl, 'trialEndsAt'>,
  now: Date,
): DistributorStatus {
  return control.trialEndsAt.getTime() > now.getTime() ? 'trial' : 'active';
}

/**
 * The note a platform admin leaves for the owner when it sends a listing back. Optional: an
 * empty note is valid and means "no note". The rules hold the same bound.
 */
export function prepareReviewNote(raw: string): Validated<string> {
  const note = raw.trim();
  const code = checkText(note, 0, REVIEW_NOTE_MAX_LENGTH);
  return code ? { ok: false, issues: [{ field: 'reviewNote', code }] } : { ok: true, value: note };
}
