import {
  createUserWithEmailAndPassword,
  deleteUser,
  getRedirectResult,
  GoogleAuthProvider,
  onIdTokenChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
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

// Verification and reset e-mails are sent by Firebase in this language.
auth.languageCode = 'es';

function toSession(user: User): Session {
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

export interface Registration {
  email: string;
  password: string;
}

/**
 * Creates the sign-in account and sends the verification e-mail. Nothing else is stored, not
 * even the name: until the address is verified nobody has proved it is theirs (PLAN 2.11).
 */
export function registerWithEmail({ email, password }: Registration): Promise<Session> {
  return translating(async () => {
    const { user } = await createUserWithEmailAndPassword(auth, email, password);
    await sendEmailVerification(user);
    return toSession(user);
  });
}

/**
 * Sets the name Firebase Auth keeps for the signed-in account. Only the account profile is the
 * source of the name; this copy is what the session carries before the profile is read.
 */
export function setSessionDisplayName(displayName: string): Promise<void> {
  return translating(() => updateProfile(requireUser(), { displayName }));
}

/**
 * Google hands over a profile photo with every sign-in and Firebase Auth keeps its address in
 * the account. The app never uses it, so it is not kept (PLAN 2.11, privacy policy §2). A
 * failure here must not break the sign-in: the next one tries again.
 */
async function dropProviderPhoto(user: User): Promise<void> {
  if (user.photoURL === null) return;
  await updateProfile(user, { photoURL: null }).catch(() => {});
}

export function signInWithEmail(email: string, password: string): Promise<Session> {
  return translating(async () => {
    const { user } = await signInWithEmailAndPassword(auth, email, password);
    return toSession(user);
  });
}

/**
 * Google sign-in with a popup. Where a popup cannot open (blocked, in-app browsers, installed
 * PWA on some phones) it falls back to a full-page redirect and resolves to null: the page
 * unloads and the session arrives through `completeRedirectSignIn` on the way back.
 */
export function signInWithGoogle(): Promise<Session | null> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return translating(async () => {
    try {
      const { user } = await signInWithPopup(auth, provider);
      await dropProviderPhoto(user);
      return toSession(user);
    } catch (error) {
      if (!isPopupUnavailable(error)) throw error;
      await signInWithRedirect(auth, provider);
      return null;
    }
  });
}

/** Call once when the app starts: returns the session if this load ends a redirect sign-in. */
export function completeRedirectSignIn(): Promise<Session | null> {
  return translating(async () => {
    const result = await getRedirectResult(auth);
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

export function resendVerificationEmail(): Promise<void> {
  return translating(() => sendEmailVerification(requireUser()));
}

/**
 * Asks Firebase to send the reset e-mail. With e-mail enumeration protection on (the default in
 * new projects) it resolves even when no account has that address; screens must not say which.
 */
export function sendPasswordReset(email: string): Promise<void> {
  return translating(() => sendPasswordResetEmail(auth, email));
}

/**
 * Re-reads the account and renews the ID token. Needed after the user follows the verification
 * link: the rules read `email_verified` from the token, and the old token still says false.
 */
export function refreshSession(): Promise<Session | null> {
  return translating(async () => {
    const user = auth.currentUser;
    if (!user) return null;
    await user.reload();
    await user.getIdToken(true);
    return auth.currentUser ? toSession(auth.currentUser) : null;
  });
}

export function currentSession(): Session | null {
  return auth.currentUser ? toSession(auth.currentUser) : null;
}

/**
 * Subscribes to the session: fires once with the restored state and again on sign-in, sign-out
 * and every token renewal (which is how a fresh `emailVerified` reaches the screens).
 */
export function onSessionChanged(listener: (session: Session | null) => void): () => void {
  return onIdTokenChanged(auth, (user) => listener(user ? toSession(user) : null));
}
