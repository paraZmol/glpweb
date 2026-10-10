import cookiesSource from '../../../docs/legal/cookies.md?raw';
import privacySource from '../../../docs/legal/privacidad.md?raw';
import termsSource from '../../../docs/legal/terminos.md?raw';
import { type LegalDocument, parseLegalDocument } from '../../domain/legal/legal-markdown';

/**
 * The legal texts shown in the app are the files of docs/legal, bundled as text at build time
 * (PLAN 2.7): editing a document there is all it takes to change the page.
 */
export const LEGAL_DOCUMENT_IDS = ['terms', 'privacy', 'cookies'] as const;
export type LegalDocumentId = (typeof LEGAL_DOCUMENT_IDS)[number];

const SOURCES: Record<LegalDocumentId, string> = {
  terms: termsSource,
  privacy: privacySource,
  cookies: cookiesSource,
};

export function legalDocument(id: LegalDocumentId): LegalDocument {
  return parseLegalDocument(SOURCES[id]);
}
