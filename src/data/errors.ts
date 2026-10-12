import { AuthError, type AuthErrorCode, authErrorFor } from '../domain/auth/errors';
import { OfflineError, PermissionDeniedError } from '../domain/tenancy/errors';

/** Firebase errors carry a string `code` such as `permission-denied` or `auth/invalid-email`. */
export function firebaseCodeOf(error: unknown): string | null {
  if (typeof error !== 'object' || error === null || !('code' in error)) return null;
  return typeof error.code === 'string' ? error.code : null;
}

const AUTH_CODES: Record<string, AuthErrorCode> = {
  'auth/email-already-in-use': 'emailAlreadyInUse',
  'auth/invalid-credential': 'invalidCredentials',
  'auth/invalid-login-credentials': 'invalidCredentials',
  'auth/wrong-password': 'invalidCredentials',
  'auth/user-not-found': 'invalidCredentials',
  'auth/missing-password': 'invalidCredentials',
  'auth/invalid-email': 'invalidEmail',
  'auth/missing-email': 'invalidEmail',
  'auth/weak-password': 'weakPassword',
  'auth/password-does-not-meet-requirements': 'weakPassword',
  'auth/too-many-requests': 'tooManyAttempts',
  'auth/network-request-failed': 'network',
  'auth/popup-closed-by-user': 'cancelled',
  'auth/cancelled-popup-request': 'cancelled',
  'auth/user-cancelled': 'cancelled',
  'auth/user-disabled': 'accountDisabled',
  'auth/account-exists-with-different-credential': 'providerMismatch',
  'auth/requires-recent-login': 'recentLoginRequired',
  'auth/user-token-expired': 'notSignedIn',
};

/** Popup sign-in cannot work here (blocked, in-app browser, installed PWA): use a redirect. */
const POPUP_UNAVAILABLE_CODES = [
  'auth/popup-blocked',
  'auth/operation-not-supported-in-this-environment',
  'auth/web-storage-unsupported',
];

export function isPopupUnavailable(error: unknown): boolean {
  return POPUP_UNAVAILABLE_CODES.includes(firebaseCodeOf(error) ?? '');
}

export function authErrorCodeFor(firebaseCode: string | null): AuthErrorCode {
  return (firebaseCode && AUTH_CODES[firebaseCode]) || 'unknown';
}

/** Translates anything thrown by Firebase Auth into a domain `AuthError`. */
export function toAuthError(error: unknown): Error {
  if (error instanceof AuthError) return error;
  return authErrorFor(authErrorCodeFor(firebaseCodeOf(error)), error);
}

const OFFLINE_CODES = ['unavailable', 'deadline-exceeded'];

/**
 * Translates the Firestore failures a screen can explain; anything else is returned untouched
 * so that bugs stay visible.
 */
export function toDataError(error: unknown): unknown {
  const code = firebaseCodeOf(error);
  if (code === 'permission-denied') return new PermissionDeniedError({ cause: error });
  if (code && OFFLINE_CODES.includes(code)) return new OfflineError({ cause: error });
  return error;
}

/**
 * Gives an operation that needs the server a time limit. Without one, a write started just as
 * the connection drops waits for as long as the connection is away and the screen never learns
 * what became of it. Past the limit it fails with `OfflineError`.
 * `operation` receives `hasExpired`: check it before the last step, so that work abandoned by
 * the screen is not carried out later behind its back.
 */
export function withDeadline<T>(
  limitMs: number,
  operation: (hasExpired: () => boolean) => Promise<T>,
): Promise<T> {
  let expired = false;
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      expired = true;
      reject(new OfflineError());
    }, limitMs);
    operation(() => expired).then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/** Runs a Firestore operation and rethrows its failure as a domain error when there is one. */
export async function guarded<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    throw toDataError(error);
  }
}
