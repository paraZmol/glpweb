import type { UserProfileInput } from '../../domain/tenancy/account-input';

// What a person typed in the registration form (name and phone), kept in THIS TAB ONLY between
// registering and accepting the terms (PLAN 2.11). Nothing is stored on the server for an
// account whose e-mail is not verified, so the profile is created later, on the terms step;
// this is what saves the person from typing it twice. `sessionStorage` dies with the tab and is
// never shared with other tabs. Declared in docs/legal/cookies.md.
export const PENDING_PROFILE_KEY = 'hornilla.pendingProfile';

interface StoredPendingProfile {
  uid: string;
  displayName: string;
  phone: string;
}

function storage(): Storage | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null; // blocked by the browser (private mode, disabled storage)
  }
}

function parse(raw: string | null): StoredPendingProfile | null {
  if (raw === null) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null) return null;
    const { uid, displayName, phone } = value as Record<string, unknown>;
    const isWellFormed =
      typeof uid === 'string' && typeof displayName === 'string' && typeof phone === 'string';
    return isWellFormed ? { uid, displayName, phone } : null;
  } catch {
    return null;
  }
}

/** Keeps what the person typed, tied to the account it registered. */
export function rememberPendingProfile(uid: string, input: UserProfileInput): void {
  const stored: StoredPendingProfile = {
    uid,
    displayName: input.displayName,
    phone: input.phone ?? '',
  };
  try {
    storage()?.setItem(PENDING_PROFILE_KEY, JSON.stringify(stored));
  } catch {
    // Full or blocked storage: the terms step asks for the name again.
  }
}

/**
 * What the account `uid` typed when it registered in this tab, or null: another tab or device,
 * a Google sign-in, or a registration by somebody else on this device (never handed over).
 */
export function readPendingProfile(uid: string): UserProfileInput | null {
  try {
    const stored = parse(storage()?.getItem(PENDING_PROFILE_KEY) ?? null);
    if (stored === null || stored.uid !== uid) return null;
    return { displayName: stored.displayName, phone: stored.phone === '' ? null : stored.phone };
  } catch {
    return null;
  }
}

/** Called once the profile exists, and whenever a session ends. */
export function forgetPendingProfile(): void {
  try {
    storage()?.removeItem(PENDING_PROFILE_KEY);
  } catch {
    // Blocked storage: nothing was kept.
  }
}
