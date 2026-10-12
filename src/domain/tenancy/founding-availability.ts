import { MAX_DISTRIBUTORS_PER_ACCOUNT } from './constants';
import { hasReadOnlyDistributor } from './listing';
import type { DistributorControl } from './types';

/**
 * Whether an account may found another distributor (PLAN 2.11):
 * - `limitReached`: it already founded as many as one account may;
 * - `blocked`: one it founded is read-only (suspended, past due or with its trial over), so the
 *   rules refuse another one (`FoundingBlockedError`);
 * - `available` otherwise.
 */
export type FoundingAvailability = 'available' | 'limitReached' | 'blocked';

/** The control document of a distributor the account founded; null when it cannot be read. */
export type OwnedControl = Pick<DistributorControl, 'status' | 'trialEndsAt'> | null;

/**
 * The same answer the founding gives, in the same order (the cap first). `controls` holds one
 * entry per distributor the account founded: one whose control document is missing blocks, as it
 * does in the rules, which cannot tell that it is operating.
 */
export function foundingAvailabilityOf(
  ownedCount: number,
  controls: readonly OwnedControl[],
  now: Date,
): FoundingAvailability {
  if (ownedCount >= MAX_DISTRIBUTORS_PER_ACCOUNT) return 'limitReached';
  const known = controls.flatMap((control) => control ?? []);
  const isBlocked = known.length < controls.length || hasReadOnlyDistributor(known, now);
  return isBlocked ? 'blocked' : 'available';
}
