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
import { DISPLAY_NAME_MAX_LENGTH } from '../../domain/tenancy/constants';
import { InvalidInputError } from '../../domain/tenancy/errors';
import type { Validated } from '../../domain/tenancy/field-checks';
import type { Address, UserProfile } from '../../domain/tenancy/types';

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
}

/**
 * Creates the account, sends the verification e-mail and stores the profile (PLAN 2.1).
 * Throws `AuthError` (see its `code`) or `InvalidInputError`.
 */
export async function registerAccount(input: RegistrationInput): Promise<Session> {
  const email = normalizeEmail(input.email);
  const profile = unwrap(prepareUserProfile(input));
  checkCredentials(email, input.password);
  const session = await authRepo.registerWithEmail({
    email,
    password: input.password,
    displayName: profile.displayName,
  });
  await usersRepo.createUserProfile(session.uid, profile);
  return session;
}

export function signIn(email: string, password: string): Promise<Session> {
  return authRepo.signInWithEmail(normalizeEmail(email), password);
}

/** The profile of an account that may be new (first Google sign-in): created when missing. */
export function ensureProfile(session: Session): Promise<UserProfile> {
  const name = (session.displayName ?? '').trim().slice(0, DISPLAY_NAME_MAX_LENGTH);
  const fallback = { displayName: name || FALLBACK_DISPLAY_NAME, phone: null };
  return usersRepo.ensureUserProfile(session.uid, fallback);
}

/**
 * Google sign-in. Resolves to the session, or to null when the browser had to leave for a
 * full-page redirect; in that case `finishGoogleRedirect()` completes it after the reload.
 */
export async function signInWithGoogle(): Promise<Session | null> {
  const session = await authRepo.signInWithGoogle();
  if (session) await ensureProfile(session);
  return session;
}

/** Call once when the app starts. Null when this load did not come back from a redirect. */
export async function finishGoogleRedirect(): Promise<Session | null> {
  const session = await authRepo.completeRedirectSignIn();
  if (session) await ensureProfile(session);
  return session;
}

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
