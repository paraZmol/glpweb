// Shared by the local Admin SDK scripts: delete-account.mjs, export-account.mjs,
// grant-platform-admin.mjs and set-distributor-status.mjs. They are manual procedures for the
// person responsible for the platform (docs/PLAN.md 2.10 and 2.11): they are NOT wired into npm
// scripts, CI or the app.
//
// Safety pattern, the same in every one of them:
//   - `--project` must be typed every time; there is no default.
//   - a project that is not an emulator needs `--yes-real-project`, also typed every time.
//   - a `demo-*` project only exists in the emulators.
//   - both emulator variables must be set, or neither: with only one of them the Admin SDK
//     would talk to the emulator for the data and to the real service for the accounts.
//   - unknown options and values that do not look like an id are refused before anything runs.
// Credentials never live in this repository: `gcloud auth application-default login`, or
// GOOGLE_APPLICATION_CREDENTIALS pointing at a key file kept outside any git repository.
// `firebase-admin` is a development dependency only (the tests run these scripts against the
// emulators); nothing under src/ imports it and it never reaches the browser bundle.

/** Reads `--name value` options and bare `--flags`. Unknown options are an error. */
export function readArguments(argv, { values = [], flags = [] }) {
  const options = Object.fromEntries([
    ...values.map((name) => [name, null]),
    ...flags.map((name) => [name, false]),
  ]);
  for (let index = 0; index < argv.length; index += 1) {
    const name = argv[index].replace(/^--/, '');
    if (!argv[index].startsWith('--')) throw new Error(`Unexpected argument "${argv[index]}".`);
    if (flags.includes(name)) options[name] = true;
    else if (values.includes(name)) options[name] = argv[(index += 1)] ?? null;
    else throw new Error(`Unknown option "--${name}".`);
  }
  return options;
}

/**
 * A Firebase Auth uid as the scripts accept it: letters, digits, `-` and `_`, 6 to 128
 * characters, starting with a letter or digit. Anything else is refused before it reaches a
 * document path: an e-mail typed by mistake, a path with slashes, a value with spaces, or the
 * next option swallowed as a value (`--uid --revoke`).
 */
const UID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{5,127}$/;

/** A document id as Firestore generates it, or one of the readable ids of the seed. */
const DOCUMENT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{5,63}$/;

function requireMatch(value, pattern, option, what) {
  if (!value) throw new Error(`Missing --${option} <${what}>.`);
  if (!pattern.test(value)) {
    throw new Error(
      `--${option} "${value}" does not look like ${what}: copy it from the Firebase console.`,
    );
  }
  return value;
}

/** The value of `--uid` (or of another option that carries a uid), or a plain refusal. */
export function requireUid(value, option = 'uid') {
  return requireMatch(value, UID_PATTERN, option, 'an account uid');
}

/** The value of `--distributor`, or a plain refusal. */
export function requireDistributorId(value, option = 'distributor') {
  return requireMatch(value, DOCUMENT_ID_PATTERN, option, 'a distributor id');
}

/**
 * Decides where the script is about to act and refuses anything ambiguous. Returns
 * `{ isEmulator, label }`; throws before any SDK is loaded or any network call is made.
 */
export function resolveTarget({ project, confirmedReal }, env = process.env) {
  if (!project) throw new Error('Missing --project <id>: there is no default on purpose.');
  const hasFirestoreEmulator = Boolean(env.FIRESTORE_EMULATOR_HOST);
  const hasAuthEmulator = Boolean(env.FIREBASE_AUTH_EMULATOR_HOST);
  if (hasFirestoreEmulator !== hasAuthEmulator) {
    throw new Error(
      'Set both FIRESTORE_EMULATOR_HOST and FIREBASE_AUTH_EMULATOR_HOST, or neither: with only ' +
        'one, half of this script would act on the real project.',
    );
  }
  const isEmulator = hasFirestoreEmulator;
  if (project.startsWith('demo-') && !isEmulator) {
    throw new Error('A demo-* project only exists in the emulators: set the emulator variables.');
  }
  if (!isEmulator && !confirmedReal) {
    throw new Error(
      `This would act on the REAL project "${project}". Re-run with --yes-real-project to confirm.`,
    );
  }
  return { isEmulator, label: isEmulator ? `${project} (emulator)` : `${project} (REAL PROJECT)` };
}

export async function loadAdminSdk(project) {
  let modules;
  try {
    modules = await Promise.all([
      import('firebase-admin/app'),
      import('firebase-admin/auth'),
      import('firebase-admin/firestore'),
    ]);
  } catch {
    throw new Error('firebase-admin is not installed: run `npm ci` in this repository first.');
  }
  const sdk = Object.assign({}, ...modules);
  sdk.initializeApp({ projectId: project });
  return sdk;
}

/** True when the Admin SDK says the account does not exist. */
export function isMissingAccount(error) {
  return typeof error === 'object' && error !== null && error.code === 'auth/user-not-found';
}

/** Firestore timestamps become ISO text, so a summary or an export is plain JSON. */
export function toPlainJson(value) {
  if (value === null || typeof value !== 'object') return value;
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(toPlainJson);
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, toPlainJson(item)]));
}

/** Runs `main` when the file is the script being executed, and reports failures plainly. */
export function runAsScript(main) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
