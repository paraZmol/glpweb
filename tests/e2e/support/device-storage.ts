import { expect, type Page } from '@playwright/test';

/** The database of the Firestore cache (see `firestoreDatabaseName` in src/data/local-wipe.ts). */
export const FIRESTORE_CACHE_DB = 'firestore/[DEFAULT]/demo-glpweb/main';

const APP_KEY_PREFIX = 'hornilla.';

/** Keys the app itself keeps in `localStorage` (the ones that start with `hornilla.`), sorted. */
export function appStorageKeys(page: Page): Promise<string[]> {
  return page.evaluate(
    (prefix) =>
      Object.keys(localStorage)
        .filter((key) => key.startsWith(prefix))
        .sort(),
    APP_KEY_PREFIX,
  );
}

const STORAGE_NOTICE_KEY = 'hornilla.storageNoticeSeen';

/**
 * Waits until the app has finished clearing the device after a session ended: of its own keys
 * only the mark of the storage notice is left. The tab reloads itself while it clears, so a
 * look that lands in the middle of the reload is simply repeated.
 */
export async function expectDeviceCleared(page: Page): Promise<void> {
  await expect(async () => {
    expect(await appStorageKeys(page)).toEqual([STORAGE_NOTICE_KEY]);
  }).toPass();
}

/**
 * Every string an origin keeps on the device, as one text to look for personal data in:
 * `localStorage`, `sessionStorage` and the rows of its IndexedDB databases (all of them, or
 * only `onlyDatabase`). Binary values are decoded as text.
 */
export function deviceStorageDump(page: Page, onlyDatabase?: string): Promise<string> {
  return page.evaluate(async (only) => {
    const open = (name: string) =>
      new Promise<IDBDatabase | null>((resolve) => {
        const request = indexedDB.open(name);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(null);
      });
    const rowsOf = (db: IDBDatabase, store: string) =>
      new Promise<unknown[]>((resolve) => {
        const all = db.transaction(store).objectStore(store).getAll();
        all.onsuccess = () => resolve(all.result);
        all.onerror = () => resolve([]);
      });
    const asText = (_key: string, value: unknown) =>
      value instanceof Uint8Array ? new TextDecoder().decode(value) : value;

    const names = (await indexedDB.databases())
      .map((database) => database.name ?? '')
      .filter((name) => name !== '' && (only === undefined || name === only));
    let dump =
      only === undefined ? JSON.stringify([{ ...localStorage }, { ...sessionStorage }]) : '';
    for (const name of names) {
      const db = await open(name);
      if (db === null) continue;
      for (const store of Array.from(db.objectStoreNames)) {
        dump += JSON.stringify(await rowsOf(db, store), asText);
      }
      db.close();
    }
    return dump;
  }, onlyDatabase);
}
