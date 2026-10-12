import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  CURRENT_TEXT_VERSIONS,
  currentEditionOf,
  LEGAL_TEXT_EDITIONS,
  LEGAL_TEXT_FILES,
  LEGAL_TEXT_IDS,
} from './text-editions';
import { compareVersions } from './versions';

/** The file as git stores it: a Windows checkout may have rewritten the line ends. */
function textOf(file: string): string {
  return readFileSync(file, 'utf8').replaceAll('\r\n', '\n');
}

const fingerprintOf = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');

const HEADER = /BORRADOR v(\d+(?:\.\d+)*) \((\d{4}-\d{2}-\d{2})\)/;

// docs/PLAN.md §11: every change of text of a legal document bumps its version.
describe.each(LEGAL_TEXT_IDS)('edition in force of the legal text "%s"', (id) => {
  const file = LEGAL_TEXT_FILES[id];
  const edition = currentEditionOf(id);

  it('is still the text that was recorded under its version', () => {
    const found = fingerprintOf(textOf(file));
    const help =
      `${file} changed, but its version is still ${edition.version}. Every change of text of a ` +
      'legal document bumps its version (docs/PLAN.md §11), because accounts accepted the text ' +
      `recorded as ${edition.version}. Do NOT replace that fingerprint. Instead: (1) put the new ` +
      `version and today's date in the header of ${file} and add it to its "Historial de ` +
      'cambios"; (2) append a new edition to LEGAL_TEXT_EDITIONS in ' +
      `src/domain/legal/text-editions.ts with sha256 ${found}; (3) raise the constant of that ` +
      'text (src/domain/legal/versions.ts, or COOKIES_VERSION) and, for terms and privacy, the ' +
      'list of accepted versions in firebase/firestore.rules.';

    expect(found, help).toBe(edition.sha256);
  });

  it('is the version and the date the document shows in its header', () => {
    const [, version, date] = HEADER.exec(textOf(file)) ?? [];

    expect({ version, publishedOn: date }).toEqual({
      version: edition.version,
      publishedOn: edition.publishedOn,
    });
  });

  it('is the version the app shows and records', () => {
    expect(CURRENT_TEXT_VERSIONS[id]).toBe(edition.version);
  });

  it('is explained in the history of changes of the document', () => {
    const history = textOf(file).split('## Historial de cambios')[1] ?? '';

    expect(history).toContain(`\n- ${edition.version} (${edition.publishedOn}):`);
  });

  it('follows the earlier editions, each with a higher version and a text of its own', () => {
    const editions = LEGAL_TEXT_EDITIONS[id];
    const versions = editions.map((each) => each.version);

    expect(versions).toEqual([...new Set(versions)].sort(compareVersions));
    expect(new Set(editions.map((each) => each.sha256)).size).toBe(editions.length);
  });
});
