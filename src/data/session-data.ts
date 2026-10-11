import { terminate, waitForPendingWrites } from 'firebase/firestore';
import { db, localCacheDatabaseName, startupWipe } from './firebase';
import {
  browserWipeEnvironment,
  hasSessionData,
  noteSessionData,
  promiseWipe,
  sessionEpochOf,
  type WipeOutcome,
  wipeSessionData,
  withdrawWipePromise,
} from './local-wipe';

/** The mark of the session this tab is showing; see src/data/local-wipe.ts. */
let knownEpoch: string | null = null;

/** Call when a session is signed in, so its local data can be told apart and erased later. */
export function noteSessionStarted(): void {
  if (localCacheDatabaseName === null) return;
  knownEpoch = noteSessionData(browserWipeEnvironment());
}

/**
 * Whether this device still holds local data of a session, as far as the marks say. Asked when
 * the app starts with nobody signed in: then that session ended without its clean-up. False
 * when this page load already tried to erase it and could not (it works from memory instead,
 * and the next start tries again): asking twice would only reload for ever.
 */
export function hasLeftoverSessionData(): boolean {
  if (localCacheDatabaseName === null || startupWipe === 'blocked') return false;
  return hasSessionData(browserWipeEnvironment());
}

/**
 * Leaves the mark "the local data of this session must be erased" BEFORE the Firebase Auth
 * session is closed (PLAN 2.11). Returns the token to hand to `withdrawLocalWipePromise` if the
 * sign-out then fails.
 */
export function promiseLocalWipe(): string | null {
  if (localCacheDatabaseName === null) return null;
  return promiseWipe(browserWipeEnvironment(), knownEpoch);
}

/** The sign-out failed: the session goes on and its local data stays. */
export function withdrawLocalWipePromise(promised: string | null): void {
  if (localCacheDatabaseName === null) return;
  withdrawWipePromise(browserWipeEnvironment(), promised);
}

/**
 * Whether writes made without a connection are still waiting to be sent. Waits up to
 * `timeoutMs` for them to go out; true means they did not, and signing out would lose them.
 */
export function hasUnsentWrites(timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(true), timeoutMs);
    const settle = () => {
      clearTimeout(timer);
      resolve(false);
    };
    // A failure here (the session changed meanwhile) means there is nothing left to wait for.
    waitForPendingWrites(db).then(settle, settle);
  });
}

/**
 * Closes Firestore in this tab and erases its local cache (PLAN 2.9). AFTER THIS THE `db`
 * INSTANCE IS DEAD: the page must be reloaded. Never rejects: when the cache cannot be erased
 * now it answers `deferred` and the next start of the app does it before opening the database.
 * Outside a browser there is no local cache and nothing is closed.
 */
export async function wipeLocalSessionData(): Promise<WipeOutcome> {
  if (localCacheDatabaseName === null) return 'skipped';
  // A tab that never saw the session (it started signed out over leftovers) erases what the
  // mark says is there, under that same mark: if the wipe has to wait for the next start, the
  // promise it leaves must name the data it is about.
  const epoch = knownEpoch ?? sessionEpochOf(browserWipeEnvironment());
  knownEpoch = null;
  try {
    return await wipeSessionData(browserWipeEnvironment(), {
      databaseName: localCacheDatabaseName,
      knownEpoch: epoch,
      closeDatabase: () => terminate(db),
    });
  } catch {
    return 'deferred';
  }
}
