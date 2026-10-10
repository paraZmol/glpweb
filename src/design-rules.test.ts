import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Rules of the design system that a linter does not see (ui-system §1, §5.1 and §15).
const SRC = fileURLToPath(new URL('.', import.meta.url));
const SCREEN_FOLDERS = ['components', 'pages'];
const GENERATED = /[\\/]components[\\/]ui[\\/]/;
const MAX_COMPONENT_LINES = 150;

function sourcesIn(folder: string): string[] {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const path = join(folder, entry.name);
    if (entry.isDirectory()) return sourcesIn(path);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

const files = SCREEN_FOLDERS.flatMap((folder) => sourcesIn(join(SRC, folder)))
  .filter((path) => !GENERATED.test(path))
  .map((path) => ({ name: relative(SRC, path), source: readFileSync(path, 'utf8') }));

const offenders = (pattern: RegExp) =>
  files.filter((file) => pattern.test(file.source)).map((file) => file.name);

describe('design rules in components and pages', () => {
  it('finds the screens to check', () => {
    expect(files.length).toBeGreaterThan(30);
  });

  it('writes no hex colour: colours come from tokens', () => {
    expect(offenders(/#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?\b(?![\w-])/)).toEqual([]);
  });

  it('never uses the primary as a text colour (2.9:1 on white): text-primary-text instead', () => {
    expect(offenders(/(?<![\w-])text-primary(?![\w-])/)).toEqual([]);
  });

  it('does not use the link variant of the shadcn button, which paints text in primary', () => {
    expect(offenders(/variant=["']link["']/)).toEqual([]);
  });

  it('injects no HTML', () => {
    expect(offenders(/dangerouslySetInnerHTML|innerHTML/)).toEqual([]);
  });

  it('writes no duration or curve by hand: motion goes through the tokens', () => {
    expect(offenders(/\bduration-\d|\bdelay-\d|\bease-(?:in|out|linear)\b|cubic-bezier/)).toEqual(
      [],
    );
    expect(offenders(/duration:\s*[\d.]+|stiffness:\s*\d/)).toEqual([]);
  });

  it('uses the strict motion components, so the animation code stays out of the first load', () => {
    expect(offenders(/import \{[^}]*\bmotion\b[^}]*\} from 'motion\/react'/)).toEqual([]);
  });

  it('never shows the internal name of the project', () => {
    expect(offenders(/glpweb/i)).toEqual([]);
  });

  it(`keeps every file within ${MAX_COMPONENT_LINES} lines`, () => {
    const long = files
      .filter((file) => file.source.split('\n').length > MAX_COMPONENT_LINES)
      .map((file) => file.name);

    expect(long).toEqual([]);
  });
});
