import { signOutSession } from '../../data/auth-repo';
import { hasUnsentWrites, wipeLocalSessionData } from '../../data/session-data';
import { forgetLastLocation } from '../../lib/last-location';
import { forgetRememberedDistributors } from '../tenancy/selection-storage';

/** How long a sign-out waits for changes made without a connection to reach the server. */
export const UNSENT_CHANGES_WAIT_MS = 4_000;

export type EndSessionOutcome =
  /** Signed out and local data cleared (or marked to be cleared at the next start). */
  | 'ended'
  /**
   * Nothing happened: changes made without a connection are still waiting to be sent, and
   * signing out would lose them. Tell the person and, if they insist, call again with
   * `discardUnsent`.
   */
  | 'unsentChanges';

export interface EndSessionOptions {
  /** Sign out even if changes made offline were never sent; they are lost. */
  discardUnsent?: boolean;
  /**
   * Runs once the sign-out is certain and before it happens: leave the private area here, or
   * its guard would show "ingresa para continuar" for an instant.
   */
  beforeSignOut?: () => void | Promise<void>;
}

// One clean-up per page: whoever starts it (the button or the watcher) owns it.
let isEnding = false;

/** Everything a session leaves on this device apart from the Firebase Auth session itself. */
async function clearLocalSessionData(): Promise<void> {
  forgetRememberedDistributors();
  // The last place searched from is a location: it does not outlive the session (PLAN 2.6).
  forgetLastLocation();
  await wipeLocalSessionData();
}

/**
 * Signs out on purpose and leaves nothing of the account on this device (PLAN 2.9): the
 * Firebase Auth session, the local copy of its data and the remembered distributor. The mark
 * of the storage notice stays. AFTER `ended` THE PAGE MUST BE RELOADED (`restartApp`): the
 * connection to the database is closed for good in this tab.
 * Throws `AuthError` if Firebase could not sign out; nothing is cleared in that case.
 */
export async function endSession(options: EndSessionOptions = {}): Promise<EndSessionOutcome> {
  const isLosingChanges = !options.discardUnsent && (await hasUnsentWrites(UNSENT_CHANGES_WAIT_MS));
  if (isLosingChanges) return 'unsentChanges';
  isEnding = true;
  try {
    await options.beforeSignOut?.();
    await signOutSession();
  } catch (error) {
    isEnding = false;
    throw error;
  }
  await clearLocalSessionData();
  return 'ended';
}

/**
 * Reloads the app, optionally at another path. It is how a tab gets a working database again
 * after its session ended; without a browser (tests under Node) it does nothing.
 */
export function restartApp(path?: string): void {
  if (typeof window === 'undefined') return;
  if (path === undefined) window.location.reload();
  else window.location.replace(path);
}

/**
 * The session ended without `endSession`: signed out in another tab, account disabled or
 * deleted, token revoked, or a screen that only closed Firebase Auth. The local data is cleared
 * the same way and the page reloads, which sends a private screen to "ingresar". Changes made
 * offline and never sent are lost: without a session they could not be sent anyway.
 * Called by the session store; screens do not call it.
 */
export function handleSessionLost(): void {
  if (isEnding || typeof window === 'undefined') return;
  isEnding = true;
  void clearLocalSessionData()
    .catch(() => {})
    .finally(() => restartApp());
}
