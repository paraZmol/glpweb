/** The signed-in account as the app sees it. Roles are never here: they come from `members`. */
export interface Session {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  displayName: string | null;
  /** How the account signs in. Always `google.com`: it is the only way in (PLAN 2.1). */
  providerIds: string[];
}

export type SessionState =
  { status: 'loading' } | { status: 'signedOut' } | { status: 'signedIn'; session: Session };

/**
 * True when the account a tab was showing is gone: signed out, or replaced by another one. Both
 * can come from another tab, or from the account being disabled or deleted (PLAN 2.9).
 */
export function hasSessionEnded(previousUid: string | null, nextUid: string | null): boolean {
  return previousUid !== null && previousUid !== nextUid;
}

/**
 * True when the app starts with nobody signed in while the device still holds the mark of a
 * session's local data: that session ended without its clean-up (the tab was closed between
 * the two steps, or the account was signed out from elsewhere while no tab was open). The data
 * must go now (PLAN 2.11). Only the first state of a page load counts: later sign-outs have
 * their own path.
 */
export function leftDataBehind(start: {
  isFirstState: boolean;
  isSignedIn: boolean;
  hasLocalSessionData: boolean;
}): boolean {
  return start.isFirstState && !start.isSignedIn && start.hasLocalSessionData;
}

/** Founding a distributor needs proof that the e-mail belongs to the account. */
export function canFoundDistributor(session: Session): boolean {
  return session.emailVerified && session.email !== null;
}
