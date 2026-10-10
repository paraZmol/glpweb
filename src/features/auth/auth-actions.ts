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
import { TERMS_VERSION } from '../../domain/legal/versions';
import { DISPLAY_NAME_MAX_LENGTH } from '../../domain/tenancy/constants';
import { InvalidInputError } from '../../domain/tenancy/errors';
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
  /** The person ticked "acepto los términos". Only `true` is accepted (PLAN 2.7). */
  acceptTerms: true;
}

/**
 * Creates the account, sends the verification e-mail and stores the profile with the
 * acceptance of the current terms (PLAN 2.1, 2.7). Nothing is created without `acceptTerms`.
 * Throws `AuthError` (see its `code`) or `InvalidInputError` (field `acceptTerms` included).
 */
export async function registerAccount(input: RegistrationInput): Promise<Session> {
  const email = normalizeEmail(input.email);
  const profile = unwrap(prepareUserProfile(input));
  requireConsents({ acceptTerms: input.acceptTerms });
  checkCredentials(email, input.password);
  const session = await authRepo.registerWithEmail({
    email,
    password: input.password,
    displayName: profile.displayName,
  });
  await usersRepo.createUserProfile(session.uid, profile, TERMS_VERSION);
  return session;
}

export function signIn(email: string, password: string): Promise<Session> {
  return authRepo.signInWithEmail(normalizeEmail(email), password);
}

/**
 * Records that the signed-in account accepts the current terms, now. CALLING THIS IS THE
 * ACCEPTANCE: only call it from the handler of an explicit "acepto" control, never on load.
 * - Account without a profile (first Google sign-in, or a registration cut before its profile
 *   was stored): creates the profile with the acceptance, named after the session.
 * - Account with a profile on an older version: renews the acceptance.
 * Then call `reload()` on `useUserProfile()`.
 */
export async function acceptCurrentTerms(uid: string): Promise<void> {
  if (await usersRepo.getUserProfile(uid)) return usersRepo.acceptTerms(uid, TERMS_VERSION);
  const session = authRepo.currentSession();
  const ownName = session?.uid === uid ? (session.displayName ?? '') : '';
  const displayName = ownName.trim().slice(0, DISPLAY_NAME_MAX_LENGTH) || FALLBACK_DISPLAY_NAME;
  return usersRepo.createUserProfile(uid, { displayName, phone: null }, TERMS_VERSION);
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
