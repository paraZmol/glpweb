import { terminate, waitForPendingWrites } from 'firebase/firestore';
import { db, localCacheDatabaseName } from './firebase';
import {
  browserWipeEnvironment,
  noteSessionData,
  type WipeOutcome,
  wipeSessionData,
} from './local-wipe';

/** The mark of the session this tab is showing; see src/data/local-wipe.ts. */
let knownEpoch: string | null = null;

/** Call when a session is signed in, so its local data can be told apart and erased later. */
export function noteSessionStarted(): void {
  if (localCacheDatabaseName === null) return;
  knownEpoch = noteSessionData(browserWipeEnvironment());
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
  const epoch = knownEpoch;
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
