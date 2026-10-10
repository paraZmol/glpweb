// Public web config: it identifies the project, it does not grant access.
// Access is decided only by the security rules in firebase/.
export const firebaseConfig = {
  projectId: 'glpweb-app',
  appId: '1:374407949055:web:2ce166d7564ea5dacd7aca',
  apiKey: 'AIzaSyApyGSUIAtyuFvUsfdJ6HMa2Hqza4d2_UU',
  authDomain: 'glpweb-app.firebaseapp.com',
  messagingSenderId: '374407949055',
  databaseURL: 'https://glpweb-app-default-rtdb.firebaseio.com',
} as const;

/** Project id used by the emulators; the `demo-` prefix makes real services unreachable. */
export const EMULATOR_PROJECT_ID = 'demo-glpweb';
