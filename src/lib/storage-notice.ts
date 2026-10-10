// Remembers on this device that the storage notice was read (docs/legal/cookies.md, "avisos ya
// vistos"). It is not a consent record: the app only stores what it needs to work.
const KEY = 'hornilla.storageNoticeSeen';
const SEEN = '1';

export function hasSeenStorageNotice(): boolean {
  try {
    return localStorage.getItem(KEY) === SEEN;
  } catch {
    return true; // storage blocked: nothing is being stored, so there is nothing to announce
  }
}

export function rememberStorageNoticeSeen(): void {
  try {
    localStorage.setItem(KEY, SEEN);
  } catch {
    // Blocked or full storage: the notice simply shows again next visit.
  }
}
