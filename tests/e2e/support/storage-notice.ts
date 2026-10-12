import type { BrowserContext, Page } from '@playwright/test';

const STORAGE_NOTICE_KEY = 'hornilla.storageNoticeSeen';
const SEEN = '1';

/**
 * Marks the storage notice as already read, before any page script runs, so it does not cover
 * the screen under test. Pass a page for one tab or a context for every tab of an actor. Call
 * it BEFORE the first `goto`; a test about the notice itself simply does not call it.
 */
export async function dismissStorageNotice(target: Page | BrowserContext): Promise<void> {
  await target.addInitScript(
    ([key, value]) => {
      try {
        window.localStorage.setItem(key, value);
      } catch {
        // Storage blocked: the app shows no notice in that case either.
      }
    },
    [STORAGE_NOTICE_KEY, SEEN] as const,
  );
}
