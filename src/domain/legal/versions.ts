// Versions of the legal texts in docs/legal. Bump one when its text changes in a way that needs
// a new acceptance (terms §11), and add the new value to `acceptedTermsVersions()` or
// `acceptedPrivacyVersions()` in firebase/firestore.rules: a rules test fails while they disagree.

export const TERMS_VERSION = '0.1';
export const PRIVACY_VERSION = '0.1';

/** Every terms version an account may hold; the last one is the current one. */
export const TERMS_VERSIONS = [TERMS_VERSION] as const;

/** Every privacy-policy version an account may hold; the last one is the current one. */
export const PRIVACY_VERSIONS = [PRIVACY_VERSION] as const;

/** Proof that an account accepted a version of a legal text, stamped with server time. */
export interface LegalAcceptance {
  version: string;
  acceptedAt: Date;
}

export type TermsAcceptance = LegalAcceptance;

/** The versions an account accepts in one go: the two boxes of the registration form. */
export interface LegalVersions {
  termsVersion: string;
  privacyVersion: string;
}

export const CURRENT_LEGAL_VERSIONS: LegalVersions = {
  termsVersion: TERMS_VERSION,
  privacyVersion: PRIVACY_VERSION,
};

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

function isOutdated(acceptance: LegalAcceptance | null, current: string): boolean {
  return acceptance === null || compareVersions(acceptance.version, current) < 0;
}

/** What the account still has to accept: nothing, one text or both. */
export function pendingLegalTexts(
  profile: { terms: LegalAcceptance | null; privacy: LegalAcceptance | null } | null,
): { terms: boolean; privacy: boolean } {
  return {
    terms: isOutdated(profile?.terms ?? null, TERMS_VERSION),
    privacy: isOutdated(profile?.privacy ?? null, PRIVACY_VERSION),
  };
}

/**
 * True when the account must accept before going on: it has no profile yet, its profile lacks
 * the acceptance of the terms or of the privacy policy, or one of them is on an older version.
 */
export function needsTermsAcceptance(
  profile: { terms: LegalAcceptance | null; privacy: LegalAcceptance | null } | null,
): boolean {
  const pending = pendingLegalTexts(profile);
  return pending.terms || pending.privacy;
}
