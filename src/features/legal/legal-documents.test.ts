import { describe, expect, it } from 'vitest';
import { type InlineRun, type LegalBlock, plainText } from '../../domain/legal/legal-markdown';
import { PRIVACY_VERSION, TERMS_VERSION } from '../../domain/legal/versions';
import { LEGAL_DOCUMENT_IDS, legalDocument, platformContactEmail } from './legal-documents';

function runsOf(block: LegalBlock): InlineRun[][] {
  if (block.kind === 'heading') return [[{ text: block.text, strong: false }]];
  if (block.kind === 'list') return block.items;
  if (block.kind === 'table') return [block.header, ...block.rows].flat();
  return [block.runs];
}

// PLAN 2.7: the pages show the documents of docs/legal as they are.
describe('legal documents of docs/legal', () => {
  it.each(LEGAL_DOCUMENT_IDS)('%s has a title, sections and text', (id) => {
    const document = legalDocument(id);

    expect(document.title).not.toBe('');
    expect(document.blocks.filter((block) => block.kind === 'heading').length).toBeGreaterThan(1);
    expect(document.blocks.length).toBeGreaterThan(4);
  });

  it.each(LEGAL_DOCUMENT_IDS)('%s is still marked as a draft, with version and date', (id) => {
    const { draft } = legalDocument(id);

    expect(draft?.version).toMatch(/^\d+\.\d+$/);
    expect(draft?.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it.each(LEGAL_DOCUMENT_IDS)('%s uses only the syntax the reader understands', (id) => {
    const texts = legalDocument(id).blocks.flatMap(runsOf).map(plainText);

    for (const text of texts) {
      expect(text).not.toMatch(/\*\*|`|\]\(|^#|^\||<\/?[a-z]/);
      expect(text.trim()).not.toBe('');
    }
  });

  it.each(LEGAL_DOCUMENT_IDS)('%s gives every section its own anchor', (id) => {
    const anchors = legalDocument(id).blocks.flatMap((block) =>
      block.kind === 'heading' ? [block.id] : [],
    );

    expect(new Set(anchors).size).toBe(anchors.length);
    expect(anchors.every((anchor) => anchor !== '')).toBe(true);
  });

  // PLAN 2.10: until the holder and its address exist, the app has no contact e-mail to show.
  it('never offers a placeholder of the terms as the contact e-mail', () => {
    expect(platformContactEmail() ?? '').not.toMatch(/[[\]\s]/);
  });

  it('shows the same terms and privacy versions that an account accepts', () => {
    expect(legalDocument('terms').draft?.version).toBe(TERMS_VERSION);
    expect(legalDocument('privacy').draft?.version).toBe(PRIVACY_VERSION);
  });
});
