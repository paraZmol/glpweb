/**
 * Which version of a listing a platform admin had in front of it (PLAN 2.11): the exact
 * `updatedAt` of the public profile and of the private settings, as opaque texts. An approval
 * carries it, and the rules accept it only while both documents are still at that version: a
 * listing edited after the review screen was opened cannot be approved from it.
 * Built by the repository (the texts keep the full precision of the stored timestamps, which a
 * `Date` would lose); here they are only compared.
 */
export interface ReviewVersion {
  readonly profile: string;
  readonly settings: string;
}

export function isSameReviewVersion(one: ReviewVersion, other: ReviewVersion): boolean {
  return one.profile === other.profile && one.settings === other.settings;
}

/**
 * What the review screen knows about the version the admin has looked at. `seen` only moves
 * when the admin says it looked at the new data (`acknowledgeReview`): data that changes on the
 * screen by itself was not reviewed just because it was displayed.
 */
export interface ReviewAttention {
  seen: ReviewVersion;
  /** An approval was refused because the listing had changed. */
  wasRefused: boolean;
}

export function startReviewAttention(shown: ReviewVersion): ReviewAttention {
  return { seen: shown, wasRefused: false };
}

/** Whether to tell the admin that the listing changed while it was being reviewed. */
export function needsSecondLook(attention: ReviewAttention, shown: ReviewVersion): boolean {
  return attention.wasRefused || !isSameReviewVersion(attention.seen, shown);
}

export function refuseStaleReview(attention: ReviewAttention): ReviewAttention {
  return { ...attention, wasRefused: true };
}

/** The admin says it looked at what is on the screen now. */
export function acknowledgeReview(shown: ReviewVersion): ReviewAttention {
  return startReviewAttention(shown);
}
