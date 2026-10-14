import {
  type Auth,
  browserPopupRedirectResolver,
  deleteUser,
  getRedirectResult,
  GoogleAuthProvider,
  onIdTokenChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { authErrorFor } from '../domain/auth/errors';
import type { Session } from '../domain/auth/session';
import { isPopupUnavailable, toAuthError } from './errors';
import { auth } from './firebase';

// Sign-in is with Google only (PLAN 2.1): this file creates no account by itself, keeps no
// password and sends no e-mail. Google's own screens are shown in this language.
auth.languageCode = 'es';

/** The app's view of a Firebase Auth account. Shared with the emulator-only sign-in. */
export function toSession(user: User): Session {
  return {
    uid: user.uid,
    email: user.email,
    emailVerified: user.emailVerified,
    displayName: user.displayName,
    providerIds: user.providerData.map((provider) => provider.providerId),
  };
}

async function translating<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    throw toAuthError(error);
  }
}

function requireUser(): User {
  if (!auth.currentUser) throw authErrorFor('notSignedIn');
  return auth.currentUser;
}

/**
 * Sets the name Firebase Auth keeps for the signed-in account. Only the account profile is the
 * source of the name; this copy is what the session carries before the profile is read.
 */
export function setSessionDisplayName(displayName: string): Promise<void> {
  return translating(() => updateProfile(requireUser(), { displayName }));
}

const IDENTITY_HOST = 'identitytoolkit.googleapis.com';

/** Where Firebase Auth takes changes to an account: the real service, or its emulator. */
function accountUpdateUrl({ config, emulatorConfig }: Auth): string {
  const origin = emulatorConfig
    ? `${emulatorConfig.protocol}://${emulatorConfig.host}:${emulatorConfig.port}/${IDENTITY_HOST}`
    : `https://${IDENTITY_HOST}`;
  return `${origin}/v1/accounts:update?key=${encodeURIComponent(config.apiKey)}`;
}

/**
 * Google hands over a profile photo with every sign-in and Firebase Auth keeps its address in
 * the account. The app never uses it, so it is not kept (PLAN 2.11, privacy policy §2).
 * `updateProfile({ photoURL: null })` does not remove it (checked against the emulator on
 * 2026-10-12: the address stays): the service only deletes it when asked by name, which the
 * SDK has no call for, so the request is made directly. A failure here must not break the
 * sign-in: the next one tries again.
 */
export async function dropProviderPhoto(user: User): Promise<void> {
  if (user.photoURL === null) return;
  try {
    const response = await fetch(accountUpdateUrl(auth), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: await user.getIdToken(), deleteAttribute: ['PHOTO_URL'] }),
    });
    if (response.ok) await user.reload();
  } catch {
    // Offline or refused: the photo stays until the next sign-in.
  }
}

/** How often the window of Google is looked at, and how long a closed one may still deliver. */
const GOOGLE_WINDOW_CHECK_MS = 250;
const GOOGLE_WINDOW_GRACE_MS = 1_000;

interface GoogleWindowWatch {
  /** Resolves once the window is closed and its grace is over. Never rejects. */
  closed: Promise<void>;
  stop: () => void;
}

/**
 * The SDK notices a closed window late: it looks every 2 s and then waits 8 s more in case the
 * result is on its way, so whoever closed it saw the button turn for ~10 s (role-walker,
 * 2026-10-14). The SDK does not hand the window over, so the next `window.open` is caught as it
 * happens, and only that one. A window that closes itself after the person chose an account has
 * delivered its result well within the grace; a result that comes later still signs in, through
 * the session listener.
 */
function watchGoogleWindow(): GoogleWindowWatch {
  const open = window.open;
  let timer: number | undefined;
  let reportClosed = () => {};
  const closed = new Promise<void>((resolve) => {
    reportClosed = resolve;
  });
  const look = (popup: Window) => {
    timer = window.setTimeout(() => {
      if (!popup.closed) return look(popup);
      timer = window.setTimeout(reportClosed, GOOGLE_WINDOW_GRACE_MS);
    }, GOOGLE_WINDOW_CHECK_MS);
  };
  const catchOne: typeof window.open = (...args) => {
    window.open = open;
    const popup = open.apply(window, args);
    if (popup) look(popup);
    return popup;
  };
  window.open = catchOne;
  const stop = () => {
    if (window.open === catchOne) window.open = open;
    window.clearTimeout(timer);
  };
  return { closed, stop };
}

async function signInWithGoogleWindow(provider: GoogleAuthProvider): Promise<Session> {
  const watch = watchGoogleWindow();
  const signingIn = signInWithPopup(auth, provider, browserPopupRedirectResolver).then(
    async ({ user }) => {
      await dropProviderPhoto(user);
      return toSession(user);
    },
  );
  const cancelled = watch.closed.then(() => Promise.reject(authErrorFor('cancelled')));
  try {
    return await Promise.race([signingIn, cancelled]);
  } finally {
    watch.stop();
  }
}

/**
 * Google sign-in with a popup. Where a popup cannot open (blocked, in-app browsers, installed
 * PWA on some phones) it falls back to a full-page redirect and resolves to null: the page
 * unloads and the session arrives through `completeRedirectSignIn` on the way back.
 * Closing the window is answered with the `cancelled` error within about a second.
 */
export function signInWithGoogle(): Promise<Session | null> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return translating(async () => {
    try {
      return await signInWithGoogleWindow(provider);
    } catch (error) {
      if (!isPopupUnavailable(error)) throw error;
      await signInWithRedirect(auth, provider, browserPopupRedirectResolver);
      return null;
    }
  });
}

/**
 * Call once when the app starts: returns the session if this load ends a redirect sign-in. The
 * SDK first looks for the mark `signInWithRedirect` leaves in this tab's session storage and
 * only with it prepares Google's sign-in frame: a visitor who never started a redirect contacts
 * nobody (PLAN §11, 2026-10-14; the E2E `no-google-before-sign-in` checks it).
 */
export function completeRedirectSignIn(): Promise<Session | null> {
  return translating(async () => {
    const result = await getRedirectResult(auth, browserPopupRedirectResolver);
    if (result) await dropProviderPhoto(result.user);
    return result ? toSession(result.user) : null;
  });
}

export function signOutSession(): Promise<void> {
  return translating(() => signOut(auth));
}

/**
 * Deletes the signed-in account from Firebase Auth. It removes nothing from Firestore: the
 * caller decides whether there is anything left behind (see `discardUnacceptedAccount`).
 * Firebase asks for a recent sign-in: an old session fails with `recentLoginRequired`.
 */
export function deleteOwnAccount(): Promise<void> {
  return translating(() => deleteUser(requireUser()));
}

export function currentSession(): Session | null {
  return auth.currentUser ? toSession(auth.currentUser) : null;
}

/**
 * Subscribes to the session: fires once with the restored state and again on sign-in, sign-out
 * and every token renewal.
 */
export function onSessionChanged(listener: (session: Session | null) => void): () => void {
  return onIdTokenChanged(auth, (user) => listener(user ? toSession(user) : null));
}
