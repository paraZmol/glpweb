import { initializeApp } from 'firebase/app';
import {
  browserLocalPersistence,
  browserSessionPersistence,
  connectAuthEmulator,
  indexedDBLocalPersistence,
  initializeAuth,
} from 'firebase/auth';
import {
  connectFirestoreEmulator,
  initializeFirestore,
  memoryLocalCache,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';
import { EMULATOR_PROJECT_ID, firebaseConfig } from './firebase-config';
import { browserWipeEnvironment, firestoreDatabaseName, runStartupWipe } from './local-wipe';

const EMULATOR_HOST = '127.0.0.1';
// Lane 0 by default; scripts/emulators.mjs passes the ports of another lane (E2E_LANE=N).
const AUTH_EMULATOR_PORT = Number(import.meta.env.VITE_AUTH_EMULATOR_PORT ?? 9099);
const FIRESTORE_EMULATOR_PORT = Number(import.meta.env.VITE_FIRESTORE_EMULATOR_PORT ?? 8080);

// Development always talks to the emulators; only a production build reaches the real project.
const useEmulators = import.meta.env.DEV || import.meta.env.VITE_USE_EMULATORS === 'true';
const projectId = useEmulators ? EMULATOR_PROJECT_ID : firebaseConfig.projectId;

export const app = initializeApp({ ...firebaseConfig, projectId });

// App Check (PLAN 2.11): OFF. It only starts when a build is given a reCAPTCHA Enterprise site
// key in VITE_APP_CHECK_SITE_KEY, which no build has today: whether to turn it on is a decision
// still open in docs/PLAN.md (it works on the no-cost plan, but running out of its monthly
// quota would lock everybody out once it is enforced). The module is loaded on demand, so a
// build without the key neither carries it nor contacts reCAPTCHA. Never with the emulators.
const appCheckSiteKey: unknown = import.meta.env.VITE_APP_CHECK_SITE_KEY;
if (!useEmulators && typeof appCheckSiteKey === 'string' && appCheckSiteKey !== '') {
  const { initializeAppCheck, ReCaptchaEnterpriseProvider } = await import('firebase/app-check');
  initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(appCheckSiteKey),
    isTokenAutoRefreshEnabled: true,
  });
}

// The same persistence getAuth() would choose, but WITHOUT the popup and redirect resolver
// (PLAN §11, 2026-10-14). With it, Auth prepares Google's sign-in frame as soon as the app opens
// on phones and in Safari, so every visitor would contact Google before asking to sign in.
// auth-repo.ts hands it to the three calls that open or finish a Google sign-in.
export const auth = initializeAuth(app, {
  persistence: [indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence],
});

// Outside a browser (repository tests under Node) there is no IndexedDB: memory cache instead.
const hasIndexedDb = typeof indexedDB !== 'undefined';

/** The IndexedDB database behind the persistent cache; null when the cache lives in memory. */
export const localCacheDatabaseName = hasIndexedDb ? firestoreDatabaseName(projectId) : null;

// A sign-out that could not erase the local cache left a mark (src/data/local-wipe.ts): the
// database is deleted here, before Firestore opens it. If it still cannot be deleted, this page
// load works from memory, so what the previous session left is never read.
export const startupWipe =
  localCacheDatabaseName === null
    ? 'none'
    : await runStartupWipe(browserWipeEnvironment(), localCacheDatabaseName);

// The local cache cuts billed reads when the app is reopened (free-quota rule in CLAUDE.md).
export const db = initializeFirestore(app, {
  localCache:
    hasIndexedDb && startupWipe !== 'blocked'
      ? persistentLocalCache({ tabManager: persistentMultipleTabManager() })
      : memoryLocalCache(),
});

if (useEmulators) {
  connectAuthEmulator(auth, `http://${EMULATOR_HOST}:${AUTH_EMULATOR_PORT}`, {
    disableWarnings: true,
  });
  connectFirestoreEmulator(db, EMULATOR_HOST, FIRESTORE_EMULATOR_PORT);
}
