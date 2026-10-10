import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import {
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';
import { EMULATOR_PROJECT_ID, firebaseConfig } from './firebase-config';

const EMULATOR_HOST = '127.0.0.1';
const AUTH_EMULATOR_PORT = 9099;
const FIRESTORE_EMULATOR_PORT = 8080;

// Development always talks to the emulators; only a production build reaches the real project.
const useEmulators = import.meta.env.DEV || import.meta.env.VITE_USE_EMULATORS === 'true';

export const app = initializeApp(
  useEmulators ? { ...firebaseConfig, projectId: EMULATOR_PROJECT_ID } : firebaseConfig,
);

export const auth = getAuth(app);

// The local cache cuts billed reads when the app is reopened (free-quota rule in CLAUDE.md).
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

if (useEmulators) {
  connectAuthEmulator(auth, `http://${EMULATOR_HOST}:${AUTH_EMULATOR_PORT}`, {
    disableWarnings: true,
  });
  connectFirestoreEmulator(db, EMULATOR_HOST, FIRESTORE_EMULATOR_PORT);
}
