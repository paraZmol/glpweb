// Versions of the legal texts in docs/legal. EVERY CHANGE OF TEXT BUMPS THE VERSION (docs/PLAN.md
// §11): "accepted 0.2 on that day" must name one text only. To change a document: new version in
// its header and history, a new edition in ./text-editions.ts (a unit test fails until then), the
// constant here, and the new value in `acceptedTermsVersions()` or `acceptedPrivacyVersions()`
// of firebase/firestore.rules (a rules test fails while they disagree).

export const TERMS_VERSION = '0.4';
export const PRIVACY_VERSION = '0.4';

/**
 * Every terms version an account may hold; the last one is the current one. 0.1 is gone on
 * purpose: it covered six different wordings, so it proves nothing, and nobody real accepted it.
 * 0.2 left the list when 0.3 was published, and 0.3 when 0.4 was (both on 2026-10-12), for the
 * second reason: no real account existed yet. Once one does, an older version stays here for as long as accounts hold it.
 */
export const TERMS_VERSIONS = [TERMS_VERSION] as const;

/** Every privacy-policy version an account may hold; the last one is the current one. */
export const PRIVACY_VERSIONS = [PRIVACY_VERSION] as const;

/** Proof that an account accepted a version of a legal text, stamped with server time. */
export interface LegalAcceptance {
  version: string;
  acceptedAt: Date;
}

export type TermsAcceptance = LegalAcceptance;

/** The texts an account accepts; each one is a field of its profile. */
export const ACCEPTED_TEXTS = ['terms', 'privacy'] as const;
export type AcceptedText = (typeof ACCEPTED_TEXTS)[number];

/**
 * One line of the history of acceptances of an account (`users/{uid}/acceptances`): it accepted
 * that version of that text then. Written once, together with the acceptance in the profile,
 * and never edited or removed from the app.
 */
export interface AcceptanceEntry extends LegalAcceptance {
  id: string;
  document: AcceptedText;
}

/** More lines than an account can gather: two texts, a handful of versions each. */
export const MAX_ACCEPTANCE_ENTRIES = 50;

/**
 * Id of a history entry (`terms-0.2`). One per text and version: the rules find the entry by
 * it, and a version that was accepted once cannot be given a new date.
 */
export function acceptanceEntryId(text: AcceptedText, version: string): string {
  return `${text}-${version}`;
}

/** The versions an account accepts in one go: the two boxes of the terms step. */
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

/** What an account holds today: the acceptance of each text, or none. */
export type HeldAcceptances = Record<AcceptedText, LegalAcceptance | null>;

export function versionOfText(versions: LegalVersions, text: AcceptedText): string {
  return text === 'terms' ? versions.termsVersion : versions.privacyVersion;
}

function isOutdated(acceptance: LegalAcceptance | null, current: string): boolean {
  return acceptance === null || compareVersions(acceptance.version, current) < 0;
}

/**
 * The texts the account has to accept to hold `versions`: the ones it never accepted or holds in
 * an older version. A text already held in that version (or a newer one) is left out, so its
 * date is not written again.
 */
export function textsToAccept(
  held: HeldAcceptances | null,
  versions: LegalVersions = CURRENT_LEGAL_VERSIONS,
): AcceptedText[] {
  return ACCEPTED_TEXTS.filter((text) =>
    isOutdated(held?.[text] ?? null, versionOfText(versions, text)),
  );
}

/** What the account still has to accept: nothing, one text or both. */
export function pendingLegalTexts(profile: HeldAcceptances | null): {
  terms: boolean;
  privacy: boolean;
} {
  const pending = textsToAccept(profile);
  return { terms: pending.includes('terms'), privacy: pending.includes('privacy') };
}

/**
 * True when the account must accept before going on: it has no profile yet, its profile lacks
 * the acceptance of the terms or of the privacy policy, or one of them is on an older version.
 */
export function needsTermsAcceptance(profile: HeldAcceptances | null): boolean {
  return textsToAccept(profile).length > 0;
}
