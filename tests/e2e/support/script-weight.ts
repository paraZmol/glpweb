import { gzipSync } from 'node:zlib';
import type { Page } from '@playwright/test';

const KB = 1024;

export interface ScriptFile {
  /** File name without the folder, e.g. `index-DrXkRQD4.js`. */
  file: string;
  /** Size after gzip (level 9), the closest thing to what Hosting sends. */
  kb: number;
}

export interface ScriptTracker {
  /** Every script the page fetched so far, once all their bodies have arrived. */
  settle: () => Promise<ScriptFile[]>;
}

/** Name of a build file without its hash: `firebase-Cw6j4zwG.js` gives `firebase`. */
export function chunkName(file: string): string {
  return file.replace(/-[\w-]{8}\.js$/, '');
}

export const totalKb = (files: readonly ScriptFile[]): number =>
  files.reduce((sum, file) => sum + file.kb, 0);

/** Starts recording the scripts under `/assets/`. Call it BEFORE the first `goto`. */
export function trackScripts(page: Page): ScriptTracker {
  const bodies: Promise<ScriptFile>[] = [];
  page.on('response', (response) => {
    const { pathname } = new URL(response.url());
    if (!pathname.startsWith('/assets/') || !pathname.endsWith('.js')) return;
    // A revalidated file (304) has no body: tests use a cold context, so this is not expected.
    if (response.status() !== 200) return;
    bodies.push(
      response.body().then((body) => ({
        file: pathname.slice('/assets/'.length),
        kb: gzipSync(body, { level: 9 }).length / KB,
      })),
    );
  });
  return { settle: () => Promise.all(bodies) };
}

/**
 * What `index.html` asks for before the first paint: the entry script and its preloads, read
 * from the file as served (the page adds more preloads later, for the chunks it loads on demand).
 */
export async function firstLoadHrefs(page: Page): Promise<string[]> {
  const html = await (await page.request.get('/')).text();
  return [...html.matchAll(/<(?:script|link)\b[^>]*?\b(?:src|href)="([^"]+\.js)"/g)].map(
    (match) => match[1] ?? '',
  );
}
