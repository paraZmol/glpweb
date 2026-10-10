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
import { AccountInUseError, InvalidInputError } from '../../domain/tenancy/errors';
import { checkConsent, collectIssues, type Validated } from '../../domain/tenancy/field-checks';
import type { Address } from '../../domain/tenancy/types';

const FALLBACK_DISPLAY_NAME = 'Sin nombre';

function unwrap<T>(result: Validated<T>): T {
  if (!result.ok) throw new InvalidInputError(result.issues);
  return result.value;
}

function checkCredentials(email: string, password: string): void {
  if (!isValidEmail(email)) throw authErrorFor('invalidEmail');
  if (!isAcceptablePassword(password)) throw authErrorFor('weakPassword');
}

function requireConsents(consents: Record<string, unknown>): void {
  const issues = collectIssues(
    Object.entries(consents).map(([field, value]) => [field, checkConsent(value)] as const),
  );
  if (issues.length > 0) throw new InvalidInputError(issues);
}

export interface RegistrationInput extends UserProfileInput {
  email: string;
  password: string;
  /** The person ticked "acepto los términos y soy mayor de edad". Only `true` is accepted. */
  acceptTerms: true;
  /**
   * The person ticked the second box, "acepto la política de privacidad" (PLAN 2.9). Only
   * `true` is accepted: a registration without it is refused with an issue on `acceptPrivacy`.
   * The type leaves it optional only so a form that does not send it yet still compiles.
   */
  acceptPrivacy?: boolean;
}

/**
 * Creates the account, sends the verification e-mail and stores the profile with the
 * acceptance of the current terms and privacy policy (PLAN 2.1, 2.7, 2.9). Nothing is created
 * without both boxes.
 * Throws `AuthError` (see its `code`) or `InvalidInputError` (fields `acceptTerms` and
 * `acceptPrivacy` included).
 */
export async function registerAccount(input: RegistrationInput): Promise<Session> {
  const email = normalizeEmail(input.email);
  const profile = unwrap(prepareUserProfile(input));
  requireConsents({ acceptTerms: input.acceptTerms, acceptPrivacy: input.acceptPrivacy });
  checkCredentials(email, input.password);
  const session = await authRepo.registerWithEmail({
    email,
    password: input.password,
    displayName: profile.displayName,
  });
  await usersRepo.createUserProfile(session.uid, profile, CURRENT_LEGAL_VERSIONS);
  return session;
}

export function signIn(email: string, password: string): Promise<Session> {
  return authRepo.signInWithEmail(normalizeEmail(email), password);
}

/**
 * Records that the signed-in account accepts the current terms AND the current privacy policy,
 * now (PLAN 2.7, 2.9). CALLING THIS IS THE ACCEPTANCE OF BOTH: only call it from the handler of
 * an explicit "acepto" control with the two boxes ticked, never on load.
 * - Account without a profile (first Google sign-in, or a registration cut before its profile
 *   was stored): creates the profile with both acceptances, named after the session.
 * - Account with a profile on an older version of either text: renews both.
 * Then call `reload()` on `useUserProfile()`.
 */
export async function acceptLegalDocuments(uid: string): Promise<void> {
  if (await usersRepo.getUserProfile(uid)) {
    return usersRepo.acceptLegalVersions(uid, CURRENT_LEGAL_VERSIONS);
  }
  const session = authRepo.currentSession();
  const ownName = session?.uid === uid ? (session.displayName ?? '') : '';
  const displayName = ownName.trim().slice(0, DISPLAY_NAME_MAX_LENGTH) || FALLBACK_DISPLAY_NAME;
  return usersRepo.createUserProfile(uid, { displayName, phone: null }, CURRENT_LEGAL_VERSIONS);
}

/** @deprecated Old name of `acceptLegalDocuments`: it records both texts, not only the terms. */
export const acceptCurrentTerms = acceptLegalDocuments;

/**
 * "No acepto: eliminar mi cuenta" (PLAN 2.9): removes the signed-in account from Firebase Auth
 * when it never accepted the terms, so it has no profile and nothing else to clean up. That is
 * the case of a first Google sign-in, where the account exists before the person accepts.
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
