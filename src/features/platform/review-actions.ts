import type { Session } from '../../domain/auth/session';
import { prepareReviewNote } from '../../domain/tenancy/listing';
import type { DistributorControl } from '../../domain/tenancy/types';
import {
  approveDistributor,
  reactivateDistributor,
  returnDistributorToReview,
  suspendDistributor,
} from './platform-actions';

/** What a platform admin can decide on one distributor (PLAN 2.11). */
export const REVIEW_ACTIONS = ['approve', 'requestChanges', 'suspend', 'reactivate'] as const;
export type ReviewAction = (typeof REVIEW_ACTIONS)[number];

type Standing = Pick<DistributorControl, 'status' | 'listingApproved'>;

const APPLIES: Record<ReviewAction, (control: Standing) => boolean> = {
  approve: (control) => !control.listingApproved,
  // Also on an approved listing: it withdraws the approval and tells the owner why.
  requestChanges: () => true,
  suspend: (control) => control.status !== 'suspended',
  reactivate: (control) => control.status === 'suspended' || control.status === 'pastDue',
};

/** The decisions that make sense for where the distributor stands, in the order they are shown. */
export function reviewActionsOf(control: Standing): ReviewAction[] {
  return REVIEW_ACTIONS.filter((action) => APPLIES[action](control));
}

const NOTE_REQUIRED = 'Escribe qué debe corregir: es lo que su titular va a leer en su panel.';
const NOTE_TOO_LONG = 'La nota es demasiado larga. Resúmela.';

/**
 * "Pedir cambios" always carries a note: sending a listing back without saying why would leave
 * its owner guessing. Returns the message for the field, or null when the note can be sent.
 * (The repository accepts an empty note; the screen does not.)
 */
export function reviewNoteProblemOf(note: string): string | null {
  if (note.trim() === '') return NOTE_REQUIRED;
  return prepareReviewNote(note).ok ? null : NOTE_TOO_LONG;
}

/** The distributor was deleted between the list and the decision. */
export class ListingGoneError extends Error {
  constructor() {
    super('The distributor no longer exists');
    this.name = 'ListingGoneError';
  }
}

export interface ReviewRequest {
  action: ReviewAction;
  admin: Session;
  distributorId: string;
  /** Only read by `requestChanges`. */
  note: string;
}

/**
 * Carries out one decision. Nothing here is optimistic: it resolves once the server has it.
 * Throws `ListingGoneError`, `InvalidInputError`, `PermissionDeniedError` or `OfflineError`.
 */
export async function runReviewAction(request: ReviewRequest): Promise<void> {
  const { action, admin, distributorId, note } = request;
  if (action === 'requestChanges') return returnDistributorToReview(distributorId, note);
  const found = await {
    approve: () => approveDistributor(admin, distributorId),
    suspend: () => suspendDistributor(distributorId),
    reactivate: () => reactivateDistributor(distributorId),
  }[action]();
  if (!found) throw new ListingGoneError();
  return undefined;
}
