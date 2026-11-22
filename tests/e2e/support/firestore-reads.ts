import type { Page } from '@playwright/test';

/**
 * Counts the documents Firestore sends to a page, which is what the free quota bills (one read
 * per document that arrives, also on a listener's first answer and on each later change).
 *
 * The web SDK talks to the emulator through streaming requests; a script added before the app
 * loads reads a copy of every answer on `/Listen/channel` and counts its `documentChange`
 * messages. It counts what arrives, not what the SDK serves from its local cache (that costs
 * nothing), so it is the number the quota sees. Call it BEFORE the first `goto`.
 *
 * It also follows the queries themselves, by the `targetChange` messages of the same answers:
 * the server acknowledges each query (`ADD`), says when it has sent all its documents
 * (`CURRENT`) and, for a one-time read (`getDocs`), when it is done with it (`REMOVE`). That is
 * how a test knows a load has finished without waiting a fixed time.
 */
export async function countFirestoreReads(page: Page): Promise<FirestoreReads> {
  await page.addInitScript(() => {
    const counter = { documents: 0, requests: 0, finished: 0, open: new Set<number>() };
    (window as unknown as { hornillaReads: typeof counter }).hornillaReads = counter;
    // One message may arrive split between two chunks: what follows the last complete match
    // is kept (up to a bound) and read again with the next chunk.
    const TOKEN = /"documentChange"|"targetChange"\s*:\s*\{[^{}]*\}/g;
    const KEPT_TAIL = 2_000;
    const onTarget = (message: string) => {
      const type = /"targetChangeType"\s*:\s*"(\w+)"/.exec(message)?.[1];
      const ids = (/"targetIds"\s*:\s*\[([^\]]*)\]/.exec(message)?.[1] ?? '')
        .split(',')
        .filter((id) => id.trim() !== '')
        .map(Number);
      for (const id of ids) {
        if (type === 'ADD') counter.open.add(id);
        if (type === 'CURRENT' || type === 'REMOVE') counter.open.delete(id);
        if (type === 'REMOVE') counter.finished += 1;
      }
    };
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
          let text = '';
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            text += decoder.decode(value, { stream: true });
            let end = 0;
            for (const match of text.matchAll(TOKEN)) {
              if (match[0] === '"documentChange"') counter.documents += 1;
              else onTarget(match[0]);
              end = (match.index ?? 0) + match[0].length;
            }
            text = text.slice(Math.max(end, text.length - KEPT_TAIL));
          }
        })().catch(() => undefined);
      }
      return response;
    };
  });
  type Counter = { documents: number; finished: number; open: Set<number> };
  const counterOf = () =>
    page.evaluate(() => {
      const counter = (window as unknown as { hornillaReads?: Counter }).hornillaReads;
      return {
        documents: counter?.documents ?? 0,
        finished: counter?.finished ?? 0,
        unanswered: counter?.open.size ?? 0,
      };
    });
  return {
    total: async () => (await counterOf()).documents,
    finishedReads: async () => (await counterOf()).finished,
    unansweredQueries: async () => (await counterOf()).unanswered,
  };
}

export interface FirestoreReads {
  /** Documents that arrived since the page opened (all navigations of the same page count). */
  total: () => Promise<number>;
  /** One-time reads (`getDocs`, `getDoc`) the server has finished answering. */
  finishedReads: () => Promise<number>;
  /** Queries the server acknowledged and has not finished answering yet. */
  unansweredQueries: () => Promise<number>;
}
