import * as authRepo from '../../data/auth-repo';
import * as usersRepo from '../../data/users-repo';
import { authErrorFor } from '../../domain/auth/errors';
import type { Session } from '../../domain/auth/session';
import {
  type AddressInput,
  prepareAddress,
  prepareUserProfile,
  type UserProfileInput,
} from '../../domain/tenancy/account-input';
import { type AcceptanceEntry, CURRENT_LEGAL_VERSIONS } from '../../domain/legal/versions';
import { DISPLAY_NAME_MAX_LENGTH } from '../../domain/tenancy/constants';
import {
  AccountInUseError,
  EmailNotVerifiedError,
  InvalidInputError,
} from '../../domain/tenancy/errors';
import type { Validated } from '../../domain/tenancy/field-checks';
import type { Address } from '../../domain/tenancy/types';

const FALLBACK_DISPLAY_NAME = 'Sin nombre';

function unwrap<T>(result: Validated<T>): T {
  if (!result.ok) throw new InvalidInputError(result.issues);
  return result.value;
}

/**
 * What the terms step shows as the name of a new account, for the person to confirm or correct
 * before the profile exists: the name its Google account gave. The phone is never known.
 */
export function suggestedProfileOf(session: Session): UserProfileInput {
  return { displayName: session.displayName ?? '', phone: null };
}

/** The profile a new account gets when the screen passes no details of its own. */
function fallbackProfile(session: Session | null): UserProfileInput {
  const suggested = session ? suggestedProfileOf(session) : { displayName: '', phone: null };
  const displayName = suggested.displayName.trim().slice(0, DISPLAY_NAME_MAX_LENGTH);
  return { displayName: displayName || FALLBACK_DISPLAY_NAME, phone: suggested.phone };
}

/**
 * Records that the signed-in account accepts the current terms AND the current privacy policy,
 * now (PLAN 2.7, 2.9). CALLING THIS IS THE ACCEPTANCE OF BOTH: only call it from the handler of
 * an explicit "acepto" control with the two boxes ticked, never on load.
 * A PROFILE ONLY EXISTS FOR A VERIFIED E-MAIL (PLAN 2.11): Google hands one over with every
 * sign-in, and for a session without it this throws `EmailNotVerifiedError` before trying (the
 * rules would refuse it anyway).
 * - Account without a profile (a first sign-in): creates the profile with both acceptances.
 *   Its name and phone are `details` when the screen passes them (validated:
 *   `InvalidInputError`), otherwise the name of the session.
 * - Account with a profile on an older version of either text: renews ONLY the text that is
 *   pending; the one it already holds in its current version keeps its date. `details` is
 *   ignored. Needs the connection: without it, it throws `OfflineError` after a few seconds.
 * Either way each accepted version also leaves a line in the history of acceptances of the
 * account (`listLegalAcceptances`), which nobody can edit or delete from the app.
 * Then call `reload()` on `useUserProfile()`.
 */
export async function acceptLegalDocuments(uid: string, details?: UserProfileInput): Promise<void> {
  const session = authRepo.currentSession();
  if (session?.uid !== uid) throw authErrorFor('notSignedIn');
  if (!session.emailVerified) throw new EmailNotVerifiedError();
  if (await usersRepo.getUserProfile(uid)) {
    return usersRepo.acceptLegalVersions(uid, CURRENT_LEGAL_VERSIONS);
  }
  const profile = unwrap(prepareUserProfile(details ?? fallbackProfile(session)));
  await usersRepo.createUserProfile(uid, profile, CURRENT_LEGAL_VERSIONS);
  // The session carries a copy of the name; a failure here changes nothing that was accepted.
  await authRepo.setSessionDisplayName(profile.displayName).catch(() => {});
}

/**
 * Every version of the terms and of the privacy policy the account accepted, newest first, with
 * the server time of each. Only the account itself and a platform admin may read it.
 */
export const listLegalAcceptances: (uid: string) => Promise<AcceptanceEntry[]> =
  usersRepo.listLegalAcceptances;

/**
 * "No acepto: eliminar mi cuenta" (PLAN 2.9): removes the signed-in account from Firebase Auth
 * when it never accepted the terms, so it has no profile and nothing else to clean up. That is
 * the case of a first sign-in, where the account exists before the person accepts.
 * Throws `AccountInUseError` if a profile exists (that deletion is handled on request, privacy
 * policy §7) and `AuthError` with code `recentLoginRequired` if the session is old: ask the
 * person to sign in again and retry. The session ends; the local data is cleared by the same
 * path as any other sign-out.
 */
export async function discardUnacceptedAccount(uid: string): Promise<void> {
  if (authRepo.currentSession()?.uid !== uid) throw authErrorFor('notSignedIn');
  if (await usersRepo.getUserProfile(uid)) throw new AccountInUseError();
  await authRepo.deleteOwnAccount();
}

/**
 * The only way in (PLAN 2.1): there is no registration apart from it, the account is created
 * by the first sign-in. Resolves to the session, or to null when the browser had to leave for a
 * full-page redirect; in that case `finishGoogleRedirect()` completes it after the reload.
 * A first-time account has no profile yet: `useUserProfile()` reports it so the screen can ask
 * for the terms (nothing is accepted on the person's behalf).
 */
export const signInWithGoogle: () => Promise<Session | null> = authRepo.signInWithGoogle;

/** Call once when the app starts. Null when this load did not come back from a redirect. */
export const finishGoogleRedirect: () => Promise<Session | null> = authRepo.completeRedirectSignIn;

export const signOut = authRepo.signOutSession;
/**
 * Saves name and phone. It resolves only once the server has them, and it never waits for
 * ever: if the connection is away (also when it drops right after the button was pressed) it
 * throws `OfflineError` within a few seconds and NOTHING STAYS QUEUED to be sent later. The
 * screen says "not saved" and the person tries again.
 * Throws `InvalidInputError`, `OfflineError`, `ProfileRequiredError` or `PermissionDeniedError`.
 */
export function saveProfile(uid: string, input: UserProfileInput): Promise<void> {
  return usersRepo.updateUserProfile(uid, unwrap(prepareUserProfile(input)));
}

export const listAddresses: (uid: string) => Promise<Address[]> = usersRepo.listAddresses;

/** Returns the id of the new address. Throws `AddressLimitError` at the cap. */
export function addAddress(uid: string, input: AddressInput): Promise<string> {
  return usersRepo.addAddress(uid, unwrap(prepareAddress(input)));
}

export function editAddress(uid: string, addressId: string, input: AddressInput): Promise<void> {
  return usersRepo.updateAddress(uid, addressId, unwrap(prepareAddress(input)));
}

export const removeAddress = usersRepo.deleteAddress;
