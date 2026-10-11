// What each version of a legal text IS: the day it was published and the SHA-256 of its file in
// docs/legal (UTF-8, line ends as LF). With it, "this account accepted terms 0.2" names one exact
// text, which can be found again in the history of the repository.
//
// APPEND ONLY. Every change of text bumps the version (docs/PLAN.md §11): add a new edition at
// the end of its list and never touch an earlier line, because accounts accepted that text.
// text-editions.test.ts fails when a document changes without a new edition.
//
// There is no 0.1 here: that number covered several wordings, so it identifies none.
import { PRIVACY_VERSION, TERMS_VERSION } from './versions';

/** Nobody accepts the cookie notice, but it is published with a version and a date like the others. */
export const COOKIES_VERSION = '0.2';

export const LEGAL_TEXT_IDS = ['terms', 'privacy', 'cookies'] as const;
export type LegalTextId = (typeof LEGAL_TEXT_IDS)[number];

export interface LegalTextEdition {
  version: string;
  /** ISO date in the header of the document. */
  publishedOn: string;
  sha256: string;
}

export const LEGAL_TEXT_FILES: Record<LegalTextId, string> = {
  terms: 'docs/legal/terminos.md',
  privacy: 'docs/legal/privacidad.md',
  cookies: 'docs/legal/cookies.md',
};

export const CURRENT_TEXT_VERSIONS: Record<LegalTextId, string> = {
  terms: TERMS_VERSION,
  privacy: PRIVACY_VERSION,
  cookies: COOKIES_VERSION,
};

export const LEGAL_TEXT_EDITIONS: Record<LegalTextId, readonly LegalTextEdition[]> = {
  terms: [
    {
      version: '0.2',
      publishedOn: '2026-10-11',
      sha256: '9287fa2f05e1dd03b6d877fb1eee7ecb8ff6c12230c00a7bc50fa9d896ac556b',
    },
  ],
  privacy: [
    {
      version: '0.2',
      publishedOn: '2026-10-11',
      sha256: 'a02ab353835b6822258bec78c6d8219f01ce152980b7f61ce44673937a9c6d66',
    },
  ],
  cookies: [
    {
      version: '0.2',
      publishedOn: '2026-10-11',
      sha256: '0aedc2bba8ee4172de81d368c16b134e769d0b21a268ee87790bca2851d268fa',
    },
  ],
};

/** The edition in force of a text: the last one of its list. */
export function currentEditionOf(id: LegalTextId): LegalTextEdition {
  const edition = LEGAL_TEXT_EDITIONS[id].at(-1);
  if (!edition) throw new Error(`No edition recorded for the legal text "${id}"`);
  return edition;
}
