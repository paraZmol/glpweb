import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import {
  connectFirestoreEmulator,
  initializeFirestore,
  memoryLocalCache,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';
import { EMULATOR_PROJECT_ID, firebaseConfig } from './firebase-config';

const EMULATOR_HOST = '127.0.0.1';
// Lane 0 by default; scripts/emulators.mjs passes the ports of another lane (E2E_LANE=N).
const AUTH_EMULATOR_PORT = Number(import.meta.env.VITE_AUTH_EMULATOR_PORT ?? 9099);
const FIRESTORE_EMULATOR_PORT = Number(import.meta.env.VITE_FIRESTORE_EMULATOR_PORT ?? 8080);

// Development always talks to the emulators; only a production build reaches the real project.
const useEmulators = import.meta.env.DEV || import.meta.env.VITE_USE_EMULATORS === 'true';

export const app = initializeApp(
  useEmulators ? { ...firebaseConfig, projectId: EMULATOR_PROJECT_ID } : firebaseConfig,
);

export const auth = getAuth(app);

// The local cache cuts billed reads when the app is reopened (free-quota rule in CLAUDE.md).
// Outside a browser (repository tests under Node) there is no IndexedDB: memory cache instead.
const hasIndexedDb = typeof indexedDB !== 'undefined';

export const db = initializeFirestore(app, {
  localCache: hasIndexedDb
    ? persistentLocalCache({ tabManager: persistentMultipleTabManager() })
    : memoryLocalCache(),
});

if (useEmulators) {
  connectAuthEmulator(auth, `http://${EMULATOR_HOST}:${AUTH_EMULATOR_PORT}`, {
    disableWarnings: true,
  });
  connectFirestoreEmulator(db, EMULATOR_HOST, FIRESTORE_EMULATOR_PORT);
}
