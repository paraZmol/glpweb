// Erasing what a session left on the device (PLAN 2.9, docs/legal/cookies.md). This file knows
// nothing about the Firebase instances: src/data/firebase.ts runs `runStartupWipe` BEFORE it
// creates Firestore, and src/data/session-data.ts calls `wipeSessionData` after closing it.
//
// Several tabs share one IndexedDB database, and deleting it shuts Firestore down in every tab
// that has it open. So a wipe must happen once per session, and never over the data of a
// session that started later. Two marks in localStorage and one lock make that true:
//
//   hornilla.localData    id of the session whose data may be in the local cache ("epoch").
//                         Written at sign-in, removed by the wipe that erases that data.
//   hornilla.pendingWipe  epoch whose wipe was promised and not finished. Written before the
//                         wipe starts, removed when it succeeds. If it is still there when the
//                         app starts, the wipe is done before Firestore opens the database.
//
// A tab erases only while holding the lock AND while `hornilla.localData` is still the epoch it
// knew: a tab that reacts late finds another epoch (or none) and leaves the data alone.

export const SESSION_EPOCH_KEY = 'hornilla.localData';
export const PENDING_WIPE_KEY = 'hornilla.pendingWipe';
const WIPE_LOCK_NAME = 'hornilla.local-wipe';
/** Firestore keeps bookkeeping for its tabs under these keys; some carry the account id. */
const FIRESTORE_STORAGE_PREFIX = 'firestore_';
/** Long enough for the other tabs to let go of the database, short enough to wait for. */
export const DELETE_TIMEOUT_MS = 3_000;

/** `pending` without a known epoch: the cache may hold data and nobody recorded whose. */
const UNKNOWN_EPOCH = 'unknown';

/**
 * Name of the IndexedDB database the Firestore SDK uses for its persistent cache:
 * `firestore/{app name}/{project id}/main` for the default database (checked against
 * @firebase/firestore 4.18, `indexedDbStoragePrefix`). The E2E of the sign-out fails if a new
 * SDK version changes it.
 */
export function firestoreDatabaseName(projectId: string, appName = '[DEFAULT]'): string {
  return `firestore/${appName}/${projectId}/main`;
}

export type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key'> & {
  readonly length: number;
};

/** Everything the protocol touches outside itself, so it can be tested without a browser. */
export interface WipeEnvironment {
  /** Null when the browser blocks storage: nothing can be coordinated, and little is stored. */
  storage: KeyValueStorage | null;
  /** Resolves to true once the database is gone, false if it could not be deleted in time. */
  deleteDatabase: (name: string) => Promise<boolean>;
  /** Runs `task` while no other tab runs one. */
  withLock: <T>(task: () => Promise<T>) => Promise<T>;
  newEpoch: () => string;
}

export type WipeOutcome =
  /** The local cache is gone. */
  | 'wiped'
  /** It could not be deleted now; the mark stays and the next start tries again. */
  | 'deferred'
  /** Another tab already did it, or the cache now belongs to a newer session. */
  | 'skipped';

function read(storage: KeyValueStorage | null, key: string): string | null {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function write(storage: KeyValueStorage | null, key: string, value: string): void {
  try {
    storage?.setItem(key, value);
  } catch {
    // Full or blocked storage: the wipe is still attempted, only without the safety mark.
  }
}

function remove(storage: KeyValueStorage | null, key: string): void {
  try {
    storage?.removeItem(key);
  } catch {
    // Nothing to do: the mark is re-evaluated at the next start.
  }
}

/** Keys of `storage` that start with `prefix` (collected first: removing shifts the indexes). */
export function keysWithPrefix(storage: KeyValueStorage, prefix: string): string[] {
  const keys: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key?.startsWith(prefix)) keys.push(key);
  }
  return keys;
}

export function removeKeysWithPrefix(storage: KeyValueStorage | null, prefix: string): void {
  if (!storage) return;
  try {
    for (const key of keysWithPrefix(storage, prefix)) storage.removeItem(key);
  } catch {
    // Blocked storage: there is nothing there to remove.
  }
}

/**
 * Call when a session is signed in: makes sure the local cache is marked as holding data of a
 * session and returns the id of that mark, which the tab must remember to wipe later.
 */
export function noteSessionData({ storage, newEpoch }: WipeEnvironment): string | null {
  const existing = read(storage, SESSION_EPOCH_KEY);
  if (existing !== null) return existing;
  const epoch = newEpoch();
  write(storage, SESSION_EPOCH_KEY, epoch);
  return read(storage, SESSION_EPOCH_KEY);
}

/** True when the cache no longer holds the data this tab meant to erase. */
function isSuperseded(knownEpoch: string | null, storedEpoch: string | null): boolean {
  return knownEpoch !== null && storedEpoch !== knownEpoch;
}

async function erase(
  environment: WipeEnvironment,
  databaseName: string,
): Promise<'wiped' | 'deferred'> {
  const { storage } = environment;
  const isDeleted = await environment.deleteDatabase(databaseName).catch(() => false);
  if (!isDeleted) return 'deferred';
  remove(storage, PENDING_WIPE_KEY);
  remove(storage, SESSION_EPOCH_KEY);
  removeKeysWithPrefix(storage, FIRESTORE_STORAGE_PREFIX);
  return 'wiped';
}

export interface SessionWipe {
  databaseName: string;
  /** What `noteSessionData` returned while the session was alive; null if it never ran. */
  knownEpoch: string | null;
  /** Closes this tab's own connection to the database (Firestore `terminate`). */
  closeDatabase: () => Promise<void>;
}

/**
 * Erases the local cache of the session that just ended in this tab. Safe to call from every
 * tab that notices the sign-out: one of them erases, the others find it done.
 */
export async function wipeSessionData(
  environment: WipeEnvironment,
  { databaseName, knownEpoch, closeDatabase }: SessionWipe,
): Promise<WipeOutcome> {
  const { storage } = environment;
  const isOurs = () => !isSuperseded(knownEpoch, read(storage, SESSION_EPOCH_KEY));
  // The promise comes first: if this tab dies half-way, the next start finishes the job.
  if (isOurs()) write(storage, PENDING_WIPE_KEY, knownEpoch ?? UNKNOWN_EPOCH);
  await closeDatabase().catch(() => {});
  return environment.withLock(async () =>
    isOurs() ? erase(environment, databaseName) : 'skipped',
  );
}

export type StartupWipe =
  /** Nothing was pending. */
  | 'none'
  | 'wiped'
  /** Still pending and the database could not be deleted: do not open it in this page load. */
  | 'blocked';

/**
 * Finishes a wipe that was promised and not done (the tab closed, or another tab kept the
 * database open). Run it before Firestore opens its database; on `blocked`, start Firestore
 * with a memory cache so the leftover data is never read.
 */
export async function runStartupWipe(
  environment: WipeEnvironment,
  databaseName: string,
): Promise<StartupWipe> {
  const { storage } = environment;
  if (read(storage, PENDING_WIPE_KEY) === null) return 'none';
  return environment.withLock(async () => {
    const pending = read(storage, PENDING_WIPE_KEY);
    if (pending === null) return 'none';
    const epoch = read(storage, SESSION_EPOCH_KEY);
    if (epoch !== null && epoch !== pending) {
      // The promise was about a session whose data is already gone: a newer one owns the cache.
      remove(storage, PENDING_WIPE_KEY);
      return 'none';
    }
    return (await erase(environment, databaseName)) === 'wiped' ? 'wiped' : 'blocked';
  });
}

// ------------------------------------------------------------------------------- browser ----

function browserStorage(): KeyValueStorage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null; // blocked by the browser (private mode, disabled storage)
  }
}

/**
 * `indexedDB.deleteDatabase` with a deadline. While another tab holds the database open the
 * request stays "blocked"; Firestore closes its connection when it sees the request, so waiting
 * a little is usually enough. A frozen tab never lets go: then the deadline answers false.
 */
function deleteIndexedDb(name: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(true);
      return;
    }
    const timer = setTimeout(() => resolve(false), DELETE_TIMEOUT_MS);
    const finish = (isDeleted: boolean) => {
      clearTimeout(timer);
      resolve(isDeleted);
    };
    try {
      const request = indexedDB.deleteDatabase(name);
      request.onsuccess = () => finish(true);
      request.onerror = () => finish(false);
    } catch {
      finish(false);
    }
  });
}

function withWebLock<T>(task: () => Promise<T>): Promise<T> {
  const locks = typeof navigator === 'undefined' ? undefined : navigator.locks;
  // Without the Web Locks API (old browsers) the wipe still runs, only without the queue.
  return locks ? (locks.request(WIPE_LOCK_NAME, task) as Promise<T>) : task();
}

/** Only has to differ between sessions on this device; it identifies nobody. */
function randomEpoch(): string {
  const hasUuid = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function';
  return hasUuid ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

export function browserWipeEnvironment(): WipeEnvironment {
  return {
    storage: browserStorage(),
    deleteDatabase: deleteIndexedDb,
    withLock: withWebLock,
    newEpoch: randomEpoch,
  };
}
