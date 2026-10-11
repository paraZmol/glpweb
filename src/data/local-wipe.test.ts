import { describe, expect, it } from 'vitest';
import {
  firestoreDatabaseName,
  hasSessionData,
  type KeyValueStorage,
  keysWithPrefix,
  noteSessionData,
  PENDING_WIPE_KEY,
  promiseWipe,
  removeKeysWithPrefix,
  runStartupWipe,
  SESSION_EPOCH_KEY,
  type WipeEnvironment,
  wipeSessionData,
  withdrawWipePromise,
} from './local-wipe';

const DATABASE = firestoreDatabaseName('demo-glpweb');
const NOTICE_KEY = 'hornilla.storageNoticeSeen';

/** localStorage as every tab of one browser sees it. */
function fakeStorage(initial: Record<string, string> = {}): KeyValueStorage {
  const items = new Map(Object.entries(initial));
  return {
    get length() {
      return items.size;
    },
    key: (index) => [...items.keys()][index] ?? null,
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => void items.set(key, value),
    removeItem: (key) => void items.delete(key),
  };
}

/** One browser: a shared storage, one database, and a lock that runs one task at a time. */
function fakeBrowser(initial: Record<string, string> = {}) {
  const storage = fakeStorage(initial);
  const deleted: string[] = [];
  let canDelete = true;
  let queue: Promise<unknown> = Promise.resolve();
  let nextEpoch = 1;
  const tab = (): WipeEnvironment => ({
    storage,
    deleteDatabase: async (name) => {
      if (canDelete) deleted.push(name);
      return canDelete;
    },
    withLock: <T>(task: () => Promise<T>) => {
      const result = queue.then(task);
      queue = result.catch(() => {});
      return result;
    },
    newEpoch: () => `epoch-${nextEpoch++}`,
  });
  return {
    storage,
    deleted,
    tab,
    blockDeletion: () => {
      canDelete = false;
    },
    allowDeletion: () => {
      canDelete = true;
    },
  };
}

const closed = () => Promise.resolve();

describe('firestoreDatabaseName', () => {
  it('builds the name the Firestore SDK gives its persistent cache', () => {
    expect(DATABASE).toBe('firestore/[DEFAULT]/demo-glpweb/main');
  });
});

describe('storage helpers', () => {
  it('finds and removes only the keys with the prefix', () => {
    const storage = fakeStorage({ 'a.1': 'x', 'a.2': 'y', 'b.1': 'z', [NOTICE_KEY]: '1' });

    expect(keysWithPrefix(storage, 'a.')).toEqual(['a.1', 'a.2']);
    removeKeysWithPrefix(storage, 'a.');

    expect(keysWithPrefix(storage, '')).toEqual(['b.1', NOTICE_KEY]);
  });

  it('does nothing when the browser blocks storage', () => {
    expect(() => removeKeysWithPrefix(null, 'a.')).not.toThrow();
  });
});

describe('noteSessionData', () => {
  it('marks the cache once per session: every tab learns the same id', () => {
    const browser = fakeBrowser();

    const first = noteSessionData(browser.tab());
    const second = noteSessionData(browser.tab());

    expect(first).toBe('epoch-1');
    expect(second).toBe(first);
    expect(browser.storage.getItem(SESSION_EPOCH_KEY)).toBe(first);
  });

  it('knows no id when storage is blocked', () => {
    expect(noteSessionData({ ...fakeBrowser().tab(), storage: null })).toBeNull();
  });
});

// PLAN 2.9: signing out leaves nothing of the account on the device.
describe('wipeSessionData', () => {
  it('closes the database, deletes it and removes its marks, keeping the storage notice', async () => {
    const browser = fakeBrowser({ [NOTICE_KEY]: '1', firestore_clients_x: '{}' });
    const knownEpoch = noteSessionData(browser.tab());
    const steps: string[] = [];
    const closeDatabase = async () => void steps.push('closed');

    const outcome = await wipeSessionData(browser.tab(), {
      databaseName: DATABASE,
      knownEpoch,
      closeDatabase,
    });

    expect(outcome).toBe('wiped');
    expect(steps).toEqual(['closed']);
    expect(browser.deleted).toEqual([DATABASE]);
    expect(keysWithPrefix(browser.storage, '')).toEqual([NOTICE_KEY]);
  });

  it('promises the wipe before it starts, so a tab that dies half-way leaves the mark', async () => {
    const browser = fakeBrowser();
    const knownEpoch = noteSessionData(browser.tab());
    let pendingWhileClosing: string | null = null;
    const closeDatabase = async () => {
      pendingWhileClosing = browser.storage.getItem(PENDING_WIPE_KEY);
    };

    await wipeSessionData(browser.tab(), { databaseName: DATABASE, knownEpoch, closeDatabase });

    expect(pendingWhileClosing).toBe(knownEpoch);
  });

  it('wipes once when two tabs notice the same sign-out', async () => {
    const browser = fakeBrowser();
    const knownEpoch = noteSessionData(browser.tab());
    const wipe = { databaseName: DATABASE, knownEpoch, closeDatabase: closed };

    const outcomes = await Promise.all([
      wipeSessionData(browser.tab(), wipe),
      wipeSessionData(browser.tab(), wipe),
    ]);

    expect(outcomes).toEqual(['wiped', 'skipped']);
    expect(browser.deleted).toHaveLength(1);
  });

  it('leaves the data of a newer session alone when a tab reacts late', async () => {
    const browser = fakeBrowser();
    const oldEpoch = noteSessionData(browser.tab());
    const wipe = { databaseName: DATABASE, knownEpoch: oldEpoch, closeDatabase: closed };
    await wipeSessionData(browser.tab(), wipe);
    const newEpoch = noteSessionData(browser.tab());

    const late = await wipeSessionData(browser.tab(), wipe);

    expect(late).toBe('skipped');
    expect(browser.deleted).toHaveLength(1);
    expect(browser.storage.getItem(SESSION_EPOCH_KEY)).toBe(newEpoch);
    expect(browser.storage.getItem(PENDING_WIPE_KEY)).toBeNull();
  });

  it('keeps the promise when the database cannot be deleted now', async () => {
    const browser = fakeBrowser();
    const knownEpoch = noteSessionData(browser.tab());
    browser.blockDeletion();

    const outcome = await wipeSessionData(browser.tab(), {
      databaseName: DATABASE,
      knownEpoch,
      closeDatabase: closed,
    });

    expect(outcome).toBe('deferred');
    expect(browser.storage.getItem(PENDING_WIPE_KEY)).toBe(knownEpoch);
  });

  it('still wipes when closing the database fails or the session was never marked', async () => {
    const browser = fakeBrowser();
    const failing = () => Promise.reject(new Error('already terminated'));

    const outcome = await wipeSessionData(browser.tab(), {
      databaseName: DATABASE,
      knownEpoch: null,
      closeDatabase: failing,
    });

    expect(outcome).toBe('wiped');
    expect(browser.deleted).toEqual([DATABASE]);
  });

  it('wipes without marks when the browser blocks storage', async () => {
    const browser = fakeBrowser();
    const tab = { ...browser.tab(), storage: null };

    const outcome = await wipeSessionData(tab, {
      databaseName: DATABASE,
      knownEpoch: null,
      closeDatabase: closed,
    });

    expect(outcome).toBe('wiped');
  });
});

describe('runStartupWipe', () => {
  it('does nothing, and deletes nothing, when no wipe is pending', async () => {
    const browser = fakeBrowser();
    noteSessionData(browser.tab());

    expect(await runStartupWipe(browser.tab(), DATABASE)).toBe('none');
    expect(browser.deleted).toEqual([]);
  });

  it('finishes a wipe that a sign-out could not do, before the database is opened', async () => {
    const browser = fakeBrowser({ [NOTICE_KEY]: '1' });
    const knownEpoch = noteSessionData(browser.tab());
    browser.blockDeletion();
    await wipeSessionData(browser.tab(), {
      databaseName: DATABASE,
      knownEpoch,
      closeDatabase: closed,
    });
    browser.allowDeletion();

    expect(await runStartupWipe(browser.tab(), DATABASE)).toBe('wiped');
    expect(browser.deleted).toEqual([DATABASE]);
    expect(keysWithPrefix(browser.storage, '')).toEqual([NOTICE_KEY]);
  });

  it('answers blocked while the database still cannot be deleted, and keeps the promise', async () => {
    const browser = fakeBrowser({ [SESSION_EPOCH_KEY]: 'e1', [PENDING_WIPE_KEY]: 'e1' });
    browser.blockDeletion();

    expect(await runStartupWipe(browser.tab(), DATABASE)).toBe('blocked');
    expect(browser.storage.getItem(PENDING_WIPE_KEY)).toBe('e1');
  });

  it('drops a promise about a session whose data a newer one replaced', async () => {
    const browser = fakeBrowser({ [SESSION_EPOCH_KEY]: 'e2', [PENDING_WIPE_KEY]: 'e1' });

    expect(await runStartupWipe(browser.tab(), DATABASE)).toBe('none');
    expect(browser.deleted).toEqual([]);
    expect(browser.storage.getItem(PENDING_WIPE_KEY)).toBeNull();
    expect(browser.storage.getItem(SESSION_EPOCH_KEY)).toBe('e2');
  });

  it('wipes when the promise is there and nobody recorded whose data it is', async () => {
    const browser = fakeBrowser({ [PENDING_WIPE_KEY]: 'unknown' });

    expect(await runStartupWipe(browser.tab(), DATABASE)).toBe('wiped');
  });

  it('wipes once when two tabs start with the same promise', async () => {
    const browser = fakeBrowser({ [SESSION_EPOCH_KEY]: 'e1', [PENDING_WIPE_KEY]: 'e1' });

    const outcomes = await Promise.all([
      runStartupWipe(browser.tab(), DATABASE),
      runStartupWipe(browser.tab(), DATABASE),
    ]);

    expect(outcomes).toEqual(['wiped', 'none']);
    expect(browser.deleted).toHaveLength(1);
  });
});

// PLAN 2.11: the promise is made before the Firebase Auth session is closed.
describe('promising the wipe before signing out', () => {
  const noClose = () => Promise.resolve();

  it('leaves the mark of the session about to end, before anything is erased', () => {
    const browser = fakeBrowser();
    const epoch = noteSessionData(browser.tab());

    const promised = promiseWipe(browser.tab(), epoch);

    expect(promised).toBe(epoch);
    expect(browser.storage.getItem(PENDING_WIPE_KEY)).toBe(epoch);
    expect(browser.deleted).toEqual([]);
  });

  it('is finished by the next start when the tab dies right after signing out', async () => {
    const browser = fakeBrowser();
    promiseWipe(browser.tab(), noteSessionData(browser.tab()));

    // The tab is gone: no wipe ran. The app starts again.
    expect(await runStartupWipe(browser.tab(), DATABASE)).toBe('wiped');

    expect(browser.deleted).toEqual([DATABASE]);
    expect(browser.storage.getItem(PENDING_WIPE_KEY)).toBeNull();
    expect(hasSessionData(browser.tab())).toBe(false);
  });

  it('is taken back when the sign-out fails: the session and its data go on', async () => {
    const browser = fakeBrowser();
    const epoch = noteSessionData(browser.tab());
    const promised = promiseWipe(browser.tab(), epoch);

    withdrawWipePromise(browser.tab(), promised);

    expect(browser.storage.getItem(PENDING_WIPE_KEY)).toBeNull();
    expect(await runStartupWipe(browser.tab(), DATABASE)).toBe('none');
    expect(browser.deleted).toEqual([]);
    expect(browser.storage.getItem(SESSION_EPOCH_KEY)).toBe(epoch);
  });

  it('does not take back a promise somebody else made', () => {
    const browser = fakeBrowser({ [PENDING_WIPE_KEY]: 'epoch-of-another-tab' });

    withdrawWipePromise(browser.tab(), 'epoch-1');
    withdrawWipePromise(browser.tab(), null);

    expect(browser.storage.getItem(PENDING_WIPE_KEY)).toBe('epoch-of-another-tab');
  });

  it('promises nothing over the data of a newer session', () => {
    const browser = fakeBrowser({ [SESSION_EPOCH_KEY]: 'epoch-newer' });

    expect(promiseWipe(browser.tab(), 'epoch-older')).toBeNull();
    expect(browser.storage.getItem(PENDING_WIPE_KEY)).toBeNull();
  });

  it('names the stored session when the tab never learned its own', () => {
    const browser = fakeBrowser({ [SESSION_EPOCH_KEY]: 'epoch-stored' });

    expect(promiseWipe(browser.tab(), null)).toBe('epoch-stored');
  });

  it('promises nothing when storage is blocked', () => {
    const blocked: WipeEnvironment = { ...fakeBrowser().tab(), storage: null };

    expect(promiseWipe(blocked, 'epoch-1')).toBeNull();
    expect(hasSessionData(blocked)).toBe(false);
  });

  it('does not get in the way of the wipe that follows a normal sign-out', async () => {
    const browser = fakeBrowser();
    const epoch = noteSessionData(browser.tab());
    promiseWipe(browser.tab(), epoch);

    const outcome = await wipeSessionData(browser.tab(), {
      databaseName: DATABASE,
      knownEpoch: epoch,
      closeDatabase: noClose,
    });

    expect(outcome).toBe('wiped');
    expect(browser.storage.getItem(PENDING_WIPE_KEY)).toBeNull();
  });
});

// PLAN 2.11: a start with nobody signed in over the mark of a session.
describe('leftovers of a session that ended without its clean-up', () => {
  it('are told by the mark of the session', () => {
    const browser = fakeBrowser();
    expect(hasSessionData(browser.tab())).toBe(false);

    noteSessionData(browser.tab());

    expect(hasSessionData(browser.tab())).toBe(true);
  });

  it('are erased by a tab that never saw that session, and survive a blocked attempt', async () => {
    const browser = fakeBrowser({ [SESSION_EPOCH_KEY]: 'epoch-left' });
    const sweep = () =>
      wipeSessionData(browser.tab(), {
        databaseName: DATABASE,
        knownEpoch: 'epoch-left',
        closeDatabase: () => Promise.resolve(),
      });
    browser.blockDeletion();

    expect(await sweep()).toBe('deferred');
    // The promise it left names that same session, so the next start finishes the job.
    expect(browser.storage.getItem(PENDING_WIPE_KEY)).toBe('epoch-left');
    browser.allowDeletion();
    expect(await runStartupWipe(browser.tab(), DATABASE)).toBe('wiped');
    expect(hasSessionData(browser.tab())).toBe(false);
  });
});
