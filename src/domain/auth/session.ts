import { EMAIL_MAX_LENGTH } from '../tenancy/constants';

/** The signed-in account as the app sees it. Roles are never here: they come from `members`. */
export interface Session {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  displayName: string | null;
  photoUrl: string | null;
  /** `password`, `google.com`… */
  providerIds: string[];
}

export type SessionState =
  { status: 'loading' } | { status: 'signedOut' } | { status: 'signedIn'; session: Session };

export const MIN_PASSWORD_LENGTH = 8;
/** Firebase Auth rejects longer passwords. */
export const MAX_PASSWORD_LENGTH = 4096;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Shape check only; whether the mailbox exists is proven by the verification e-mail. */
export function isValidEmail(email: string): boolean {
  return email.length <= EMAIL_MAX_LENGTH && EMAIL_PATTERN.test(email);
}

export function isAcceptablePassword(password: string): boolean {
  return password.length >= MIN_PASSWORD_LENGTH && password.length <= MAX_PASSWORD_LENGTH;
}

/** Founding a distributor needs proof that the e-mail belongs to the account. */
export function canFoundDistributor(session: Session): boolean {
  return session.emailVerified && session.email !== null;
}
