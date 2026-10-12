import { MAX_DISTRIBUTORS_PER_ACCOUNT } from '../../domain/tenancy/constants';
import type { FoundingAvailability } from '../../domain/tenancy/founding-availability';
import type { UserProfile } from '../../domain/tenancy/types';
import type { CurrentDistributor } from './use-current-distributor';

export type { FoundingAvailability } from '../../domain/tenancy/founding-availability';

interface LoadedAccount {
  uid: string;
  profile: Pick<UserProfile, 'ownedDistributorIds'> | null;
  current: CurrentDistributor;
}

/**
 * What is certain about the founding with what the account already has on screen, without
 * reading anything: the cap, and the distributor the panels show when the account founded it and
 * it is read-only. `available` here only means "nothing known against it": the distributors
 * that are not selected are judged by `useFoundingAvailability()`.
 */
export function knownFoundingAvailability(account: LoadedAccount): FoundingAvailability {
  const { uid, profile, current } = account;
  if ((profile?.ownedDistributorIds.length ?? 0) >= MAX_DISTRIBUTORS_PER_ACCOUNT) {
    return 'limitReached';
  }
  const foundedReadOnly =
    current.status === 'ready' && current.distributor.ownerUid === uid && !current.isWritable;
  return foundedReadOnly ? 'blocked' : 'available';
}

/**
 * The distributors the account founded whose standing is not on screen: all of them but the
 * selected one. Empty while the selected one is still loading (wait instead of reading it twice).
 */
export function unseenOwnedIds({ uid, profile, current }: LoadedAccount): string[] {
  if (profile === null || current.status === 'loading' || current.status === 'idle') return [];
  const seenId =
    current.status === 'ready' && current.distributor.ownerUid === uid
      ? current.distributor.id
      : null;
  return profile.ownedDistributorIds.filter((id) => id !== seenId);
}
