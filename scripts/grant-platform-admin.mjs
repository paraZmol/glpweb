// Grants (or revokes) the platform admin role. This is the ONLY way to become a super admin:
// the security rules allow no write to /platformAdmins from the app (docs/PLAN.md §3).
//
// It is a manual, local procedure. It is NOT wired into npm scripts, CI or the app. It runs
// from this repository after `npm ci`: `firebase-admin` is a development dependency (the tests
// run these scripts against the emulators) and never reaches the browser bundle.
//
// How to run it against the real project (a deliberate, outward action: only the project owner,
// and only after confirming the uid):
//
//   1. Authenticate WITHOUT a key file when possible:
//        gcloud auth application-default login
//      (or, if a service-account key is unavoidable, keep it outside any git repository and
//      point GOOGLE_APPLICATION_CREDENTIALS at it; delete the key when done).
//   2. Find the uid of the account in the Firebase console → Authentication. Never grant by
//      e-mail typed from memory: uids do not have typos that belong to someone else.
//   3. Run:
//        node scripts/grant-platform-admin.mjs --project <project-id> --uid <uid> --yes-real-project
//        node scripts/grant-platform-admin.mjs --project <project-id> --uid <uid> --revoke --yes-real-project
//      The project id and the confirmation flag must be typed every time; there is no default
//      on purpose. See scripts/admin-common.mjs for the safety pattern.
//
// To try it against the emulators instead (safe; this is what the tests do):
//        FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
//          node scripts/grant-platform-admin.mjs --project demo-glpweb --uid seed-cliente
//
// What it writes: /platformAdmins/{uid} = { createdAt, grantedBy: 'script' }. The rules only
// check that the document exists.
import { pathToFileURL } from 'node:url';
import {
  loadAdminSdk,
  readArguments,
  requireUid,
  resolveTarget,
  runAsScript,
} from './admin-common.mjs';

/**
 * Grants the role to `uid`, or takes it away with `revoke`. Refuses to grant to an account that
 * does not exist or never proved its e-mail. Returns what it did: 'granted' or 'revoked'.
 */
export async function grantPlatformAdmin(sdk, uid, { revoke = false } = {}) {
  const reference = sdk.getFirestore().doc(`platformAdmins/${uid}`);
  if (revoke) {
    await reference.delete();
    return 'revoked';
  }
  const account = await sdk.getAuth().getUser(uid);
  if (!account.emailVerified) {
    throw new Error(`Account ${uid} has no verified e-mail: not granting.`);
  }
  await reference.set({ createdAt: sdk.FieldValue.serverTimestamp(), grantedBy: 'script' });
  return 'granted';
}

async function main(argv) {
  const options = readArguments(argv, {
    values: ['project', 'uid'],
    flags: ['revoke', 'yes-real-project'],
  });
  const target = resolveTarget({
    project: options.project,
    confirmedReal: options['yes-real-project'],
  });
  const uid = requireUid(options.uid);
  const sdk = await loadAdminSdk(options.project);
  const outcome = await grantPlatformAdmin(sdk, uid, { revoke: options.revoke });
  const verb = outcome === 'granted' ? 'Granted' : 'Revoked';
  process.stdout.write(`${verb} platform admin for ${uid} on ${target.label}.\n`);
}

const isCommandLine =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isCommandLine) runAsScript(main);
