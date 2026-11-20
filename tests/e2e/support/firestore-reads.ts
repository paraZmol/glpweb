import type { Page } from '@playwright/test';

/**
 * Counts the documents Firestore sends to a page, which is what the free quota bills (one read
 * per document that arrives, also on a listener's first answer and on each later change).
 *
 * The web SDK talks to the emulator through streaming requests; a script added before the app
 * loads reads a copy of every answer on `/Listen/channel` and counts its `documentChange`
 * messages. It counts what arrives, not what the SDK serves from its local cache (that costs
 * nothing), so it is the number the quota sees. Call it BEFORE the first `goto`.
 */
export async function countFirestoreReads(page: Page): Promise<FirestoreReads> {
  await page.addInitScript(() => {
    const counter = { documents: 0, requests: 0 };
    (window as unknown as { hornillaReads: typeof counter }).hornillaReads = counter;
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const response = await originalFetch(input, init);
      const url =
        typeof input === 'string' ? input : input instanceof Request ? input.url : `${input}`;
      if (url.includes('/Listen/channel') && response.body) {
        counter.requests += 1;
        const reader = response.clone().body?.getReader();
        const decoder = new TextDecoder();
        void (async () => {
          if (!reader) return;
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            counter.documents +=
              decoder.decode(value, { stream: true }).split('"documentChange"').length - 1;
          }
        })().catch(() => undefined);
      }
      return response;
    };
  });
  return {
    total: () =>
      page.evaluate(
        () =>
          (window as unknown as { hornillaReads?: { documents: number } }).hornillaReads
            ?.documents ?? 0,
      ),
  };
}

export interface FirestoreReads {
  /** Documents that arrived since the page opened (all navigations of the same page count). */
  total: () => Promise<number>;
}
