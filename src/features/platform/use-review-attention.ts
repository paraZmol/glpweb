import { useCallback, useState } from 'react';
import {
  acknowledgeReview,
  followUnreviewedChange,
  needsSecondLook,
  refuseStaleReview,
  type ReviewVersion,
  startReviewAttention,
} from '../../domain/tenancy/review-version';

export interface ReviewAttentionState {
  /** The version the admin looked at: what an approval is sent for. */
  seen: ReviewVersion;
  /**
   * The listing changed while it was being reviewed (or an approval was refused for that
   * reason): say so, and do not treat the new data as reviewed until `acknowledge()`.
   */
  needsSecondLook: boolean;
  /** An approval came back with `StaleReviewError`. */
  refuse: () => void;
  /** The admin says it looked at the data that is on screen now. */
  acknowledge: () => void;
}

/**
 * Keeps apart what the review screen shows (live) and what the admin has looked at (PLAN 2.11).
 * `shown` is `review.version` and `content` is `reviewedContentOf(review)`. Data that arrives by
 * itself is displayed at once, but an approval still goes out for the version seen before, so
 * the rules refuse it until the admin acknowledges the new data. A version that moves without
 * changing a reviewed word (a suspension by somebody else) asks for nothing. Mount it once per
 * listing (`key` by distributor).
 */
export function useReviewAttention(shown: ReviewVersion, content: string): ReviewAttentionState {
  const [held, setAttention] = useState(() => startReviewAttention(shown, content));
  const attention = followUnreviewedChange(held, shown, content);
  if (attention !== held) setAttention(attention);
  const refuse = useCallback(() => setAttention(refuseStaleReview), []);
  const acknowledge = useCallback(
    () => setAttention(acknowledgeReview(shown, content)),
    [shown, content],
  );
  return {
    seen: attention.seen,
    needsSecondLook: needsSecondLook(attention, shown),
    refuse,
    acknowledge,
  };
}
