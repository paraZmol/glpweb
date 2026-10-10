import { type LegalBlock, type LegalDocument, plainText } from './legal-markdown';

// The terms name the contact address of the platform in §1 ("Contacto: …"). While the document
// is a draft that value is a placeholder in square brackets, and there is no address to show.
const CONTACT_PATTERN = /Contacto:\s*([^\s[\]]+@[^\s[\]]+\.[a-z]{2,})/i;
const TRAILING_PUNCTUATION = /[.,;:]+$/;

function textOf(block: LegalBlock): string {
  return block.kind === 'paragraph' || block.kind === 'note' ? plainText(block.runs) : '';
}

/**
 * The contact e-mail the terms publish, or null while it is still a placeholder
 * ("[correo de contacto]"). The screens never invent one: they say it is not published yet.
 */
export function contactEmailOf(terms: LegalDocument): string | null {
  for (const block of terms.blocks) {
    const [, address] = CONTACT_PATTERN.exec(textOf(block)) ?? [];
    if (address) return address.replace(TRAILING_PUNCTUATION, '').toLowerCase();
  }
  return null;
}
