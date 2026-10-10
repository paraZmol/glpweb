import { keysWithPrefix } from '../../data/local-wipe';

// Which distributor the panels show, remembered per account on this device. It is only a
// preference: what the account may do there is decided by its member document and the rules.
const KEY_PREFIX = 'hornilla.currentDistributor.';

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null; // blocked by the browser (private mode, disabled storage)
  }
}

export function readRememberedDistributor(uid: string): string | null {
  try {
    return storage()?.getItem(KEY_PREFIX + uid) ?? null;
  } catch {
    return null;
  }
}

export function rememberDistributor(uid: string, distributorId: string): void {
  try {
    storage()?.setItem(KEY_PREFIX + uid, distributorId);
  } catch {
    // Quota or blocked storage: the selection simply lasts for this visit only.
  }
}

/**
 * Forgets the choice of every account that used this device (PLAN 2.9): the key carries the
 * account id, so signing out must not leave any of them behind.
 */
export function forgetRememberedDistributors(): void {
  try {
    const store = storage();
    if (!store) return;
    for (const key of keysWithPrefix(store, KEY_PREFIX)) store.removeItem(key);
  } catch {
    // Blocked storage: nothing was remembered.
  }
}
