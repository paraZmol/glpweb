// Versions of the legal texts in docs/legal. Bump one when its text changes in a way that needs
// a new acceptance (terms §11), and add the new value to `acceptedTermsVersions()` in
// firebase/firestore.rules: a rules test fails while the two disagree.

export const TERMS_VERSION = '0.1';
export const PRIVACY_VERSION = '0.1';

/** Every terms version an account may hold; the last one is the current one. */
export const TERMS_VERSIONS = [TERMS_VERSION] as const;

/** Proof that an account accepted a version of the terms, stamped with server time. */
export interface TermsAcceptance {
  version: string;
  acceptedAt: Date;
}

/** Compares dotted versions numerically ("0.10" is newer than "0.9"). Negative when a < b. */
export function compareVersions(a: string, b: string): number {
  const left = a.split('.').map(Number);
  const right = b.split('.').map(Number);
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const difference = (left[index] || 0) - (right[index] || 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

/**
 * True when the account must accept the terms before going on: it has no profile yet, its
 * profile carries no acceptance, or it accepted a version older than the current one.
 */
export function needsTermsAcceptance(profile: { terms: TermsAcceptance | null } | null): boolean {
  if (!profile?.terms) return true;
  return compareVersions(profile.terms.version, TERMS_VERSION) < 0;
}
