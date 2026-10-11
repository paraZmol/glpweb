import * as authRepo from '../../data/auth-repo';
import * as usersRepo from '../../data/users-repo';
import { authErrorFor } from '../../domain/auth/errors';
import {
  isAcceptablePassword,
  isValidEmail,
  normalizeEmail,
  type Session,
} from '../../domain/auth/session';
import {
  type AddressInput,
  prepareAddress,
  prepareUserProfile,
  type UserProfileInput,
} from '../../domain/tenancy/account-input';
import { CURRENT_LEGAL_VERSIONS } from '../../domain/legal/versions';
import { DISPLAY_NAME_MAX_LENGTH } from '../../domain/tenancy/constants';
import {
  AccountInUseError,
  EmailNotVerifiedError,
  InvalidInputError,
} from '../../domain/tenancy/errors';
import type { Validated } from '../../domain/tenancy/field-checks';
import type { Address } from '../../domain/tenancy/types';
import {
  forgetPendingProfile,
  readPendingProfile,
  rememberPendingProfile,
} from './pending-profile';

const FALLBACK_DISPLAY_NAME = 'Sin nombre';

function unwrap<T>(result: Validated<T>): T {
  if (!result.ok) throw new InvalidInputError(result.issues);
  return result.value;
}

function checkCredentials(email: string, password: string): void {
  if (!isValidEmail(email)) throw authErrorFor('invalidEmail');
  if (!isAcceptablePassword(password)) throw authErrorFor('weakPassword');
}

export interface RegistrationInput extends UserProfileInput {
  email: string;
  password: string;
  /**
   * @deprecated Registering no longer records any consent (PLAN 2.11): the terms and the privacy
   * policy are accepted on the terms step, once the e-mail is verified. Both fields are ignored
   * and stay in the type only so the registration screen of before still compiles.
   */
  acceptTerms?: boolean;
  /** @deprecated See `acceptTerms`. */
  acceptPrivacy?: boolean;
}

/**
 * Creates the sign-in account and sends the verification e-mail (PLAN 2.1, 2.11). NOTHING ELSE
 * IS STORED ON THE SERVER: no profile, no consent, not even the name, because nobody has proved
 * yet that the e-mail is theirs. The name and the phone are validated here and kept in this tab
 * (`pending-profile.ts`) so that the terms step, after the verification, does not ask again.
 * Next steps for the screens: `/verificar-correo`, then `/aceptar-terminos`, where
 * `acceptLegalDocuments` creates the profile with both acceptances.
 * Throws `AuthError` (see its `code`) or `InvalidInputError` (fields `displayName`, `phone`).
 */
export async function registerAccount(input: RegistrationInput): Promise<Session> {
  const email = normalizeEmail(input.email);
  const profile = unwrap(prepareUserProfile(input));
  checkCredentials(email, input.password);
  const session = await authRepo.registerWithEmail({ email, password: input.password });
  rememberPendingProfile(session.uid, profile);
  return session;
}

/**
 * What the terms step should show as the name and phone of a new account, so the person can
 * confirm or correct them before the profile exists: what it typed when registering in this
 * tab, else the name its Google account gave, else nothing.
 */
export function suggestedProfileOf(session: Session): UserProfileInput {
  return readPendingProfile(session.uid) ?? { displayName: session.displayName ?? '', phone: null };
}

export function signIn(email: string, password: string): Promise<Session> {
  return authRepo.signInWithEmail(normalizeEmail(email), password);
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
 * THE E-MAIL MUST BE VERIFIED FIRST (PLAN 2.11): the rules store nothing for an account that
 * has not proved its address, so this throws `EmailNotVerifiedError` before trying.
 * - Account without a profile (a registration that has just verified its e-mail, or a first
 *   Google sign-in): creates the profile with both acceptances. Its name and phone are
 *   `details` when the screen passes them (validated: `InvalidInputError`), otherwise what the
 *   person typed when registering in this tab, otherwise the name of the session.
 * - Account with a profile on an older version of either text: renews both; `details` is
 *   ignored.
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
  forgetPendingProfile();
  // The session carries a copy of the name; a failure here changes nothing that was accepted.
  await authRepo.setSessionDisplayName(profile.displayName).catch(() => {});
}

/** @deprecated Old name of `acceptLegalDocuments`: it records both texts, not only the terms. */
export const acceptCurrentTerms = acceptLegalDocuments;

/**
 * "No acepto: eliminar mi cuenta" (PLAN 2.9): removes the signed-in account from Firebase Auth
 * when it never accepted the terms, so it has no profile and nothing else to clean up. That is
 * the case of a first Google sign-in, where the account exists before the person accepts.
 * It also serves an account that registered and never verified its e-mail: it has no profile
 * either (PLAN 2.11).
 * Throws `AccountInUseError` if a profile exists (that deletion is handled on request, privacy
 * policy §7) and `AuthError` with code `recentLoginRequired` if the session is old: ask the
 * person to sign in again and retry. The session ends; the local data is cleared by the same
 * path as any other sign-out.
 */
export async function discardUnacceptedAccount(uid: string): Promise<void> {
  if (authRepo.currentSession()?.uid !== uid) throw authErrorFor('notSignedIn');
  if (await usersRepo.getUserProfile(uid)) throw new AccountInUseError();
  await authRepo.deleteOwnAccount();
  forgetPendingProfile();
}

/**
 * Google sign-in. Resolves to the session, or to null when the browser had to leave for a
 * full-page redirect; in that case `finishGoogleRedirect()` completes it after the reload.
 * A first-time account has no profile yet: `useUserProfile()` reports it so the screen can ask
 * for the terms (nothing is accepted on the person's behalf).
 */
export const signInWithGoogle: () => Promise<Session | null> = authRepo.signInWithGoogle;

/** Call once when the app starts. Null when this load did not come back from a redirect. */
export const finishGoogleRedirect: () => Promise<Session | null> = authRepo.completeRedirectSignIn;

export const signOut = authRepo.signOutSession;
export const resendVerificationEmail = authRepo.resendVerificationEmail;

/** After the user says "ya verifiqué": re-reads the account so `emailVerified` is current. */
export const refreshSession = authRepo.refreshSession;

/** Resolves even when no account uses that address: never tell the visitor which case it was. */
export function requestPasswordReset(email: string): Promise<void> {
  const normalized = normalizeEmail(email);
  if (!isValidEmail(normalized)) throw authErrorFor('invalidEmail');
  return authRepo.sendPasswordReset(normalized);
}

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
