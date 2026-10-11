import { MAX_DISTRIBUTORS_PER_ACCOUNT } from '../../domain/tenancy/constants';
import type { UserProfile } from '../../domain/tenancy/types';
import type { CurrentDistributor } from './use-current-distributor';

/**
 * Whether the screens should offer an account the sign-up of a distributor (PLAN 2.11):
 * - `limitReached`: it already founded as many as one account may;
 * - `blocked`: it founded one that is read-only (suspended, past due or with its trial over),
 *   so the rules refuse another one (`FoundingBlockedError`);
 * - `available` otherwise.
 * It only decides what to SHOW, with what is already loaded: the founding itself has the last
 * word. Of the distributors the account founded, only the one the panels show is known here, so
 * a read-only one that is not selected goes unnoticed until the sign-up is sent.
 */
export type FoundingAvailability = 'available' | 'limitReached' | 'blocked';

export function foundingAvailabilityOf(account: {
  uid: string;
  profile: Pick<UserProfile, 'ownedDistributorIds'> | null;
  current: CurrentDistributor;
}): FoundingAvailability {
  const { uid, profile, current } = account;
  if ((profile?.ownedDistributorIds.length ?? 0) >= MAX_DISTRIBUTORS_PER_ACCOUNT) {
    return 'limitReached';
  }
  const foundedReadOnly =
    current.status === 'ready' && current.distributor.ownerUid === uid && !current.isWritable;
  return foundedReadOnly ? 'blocked' : 'available';
}
