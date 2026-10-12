import { useAsyncResource } from '../../lib/use-async-resource';
import { useAccount } from '../account/account-context';
import {
  type FoundingAvailability,
  knownFoundingAvailability,
  unseenOwnedIds,
} from './founding-availability';
import { checkOwnedDistributors } from './tenancy-actions';

export interface FoundingCheck {
  /**
   * `limitReached` or `blocked` as soon as it is known; `available` otherwise, also while the
   * check is still running or when it failed (the founding itself has the last word).
   */
  availability: FoundingAvailability;
  /** True while the distributors that are not on screen are being read. */
  isChecking: boolean;
  reload: () => void;
}

/**
 * Whether to offer the signed-in account the sign-up of a distributor (PLAN 2.11), looking at
 * EVERY distributor it founded and not only at the one the panels show. Only for screens behind
 * `RequireAccess`.
 * Cost: nothing for an account that founded none, that is at the cap, or whose only distributor
 * is the selected one; otherwise one read per other distributor it founded (at most 2), once
 * per visit to the screen. No listener: call `reload()` to ask again.
 */
export function useFoundingAvailability(): FoundingCheck {
  const { session, profile, current } = useAccount();
  const account = { uid: session.uid, profile, current };
  const known = knownFoundingAvailability(account);
  const unseen = unseenOwnedIds(account);
  const ownedCount = profile?.ownedDistributorIds.length ?? 0;
  const key = known === 'available' && unseen.length > 0 ? unseen.join(',') : null;
  const rest = useAsyncResource(key, () => checkOwnedDistributors(ownedCount, unseen));

  const isWaitingForSelected = known === 'available' && current.status === 'loading';
  return {
    availability: rest.status === 'ready' ? rest.data : known,
    isChecking: rest.status === 'loading' || isWaitingForSelected,
    reload: rest.reload,
  };
}
