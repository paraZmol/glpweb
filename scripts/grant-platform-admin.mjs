// Grants (or revokes) the platform admin role. This is the ONLY way to become a super admin:
// the security rules allow no write to /platformAdmins from the app (docs/PLAN.md §3).
//
// It is a manual, local procedure. It is NOT wired into npm scripts, CI or the app, and
// `firebase-admin` is deliberately not a dependency of this repository.
//
// How to run it against the real project (a deliberate, outward action: only the project owner,
// and only after confirming the uid):
//
//   1. Work in a folder OUTSIDE this repository, e.g. a private `hornilla-admin` folder.
//      Copy this file there and run `npm init -y && npm install firebase-admin`.
//   2. Authenticate WITHOUT a key file when possible:
//        gcloud auth application-default login
//      (or, if a service-account key is unavoidable, keep it outside any git repository and
//      point GOOGLE_APPLICATION_CREDENTIALS at it; delete the key when done).
//   3. Find the uid of the account in the Firebase console → Authentication. Never grant by
//      e-mail typed from memory: uids do not have typos that belong to someone else.
//   4. Run:
//        node grant-platform-admin.mjs --project <project-id> --uid <uid> --yes-real-project
//        node grant-platform-admin.mjs --project <project-id> --uid <uid> --revoke --yes-real-project
//      The project id and the confirmation flag must be typed every time; there is no default
//      on purpose.
//
// To try it against the emulators instead (safe):
//        FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
//          node grant-platform-admin.mjs --project demo-glpweb --uid seed-cliente
//
// What it writes: /platformAdmins/{uid} = { createdAt, grantedBy: 'script' }. The rules only
// check that the document exists.

function readArguments(argv) {
  const options = { project: null, uid: null, revoke: false, confirmedReal: false };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--project') options.project = argv[index + 1] ?? null;
    if (argv[index] === '--uid') options.uid = argv[index + 1] ?? null;
    if (argv[index] === '--revoke') options.revoke = true;
    if (argv[index] === '--yes-real-project') options.confirmedReal = true;
  }
  return options;
}

async function loadAdminSdk() {
  try {
    const [app, auth, firestore] = await Promise.all([
      import('firebase-admin/app'),
      import('firebase-admin/auth'),
      import('firebase-admin/firestore'),
    ]);
    return { ...app, ...auth, ...firestore };
  } catch {
    throw new Error(
      'firebase-admin is not installed here. Follow the steps at the top of this file: ' +
        'this script runs from a private folder outside the repository.',
    );
  }
}

async function main() {
  const { project, uid, revoke, confirmedReal } = readArguments(process.argv.slice(2));
  if (!project || !uid) {
    throw new Error('Usage: node grant-platform-admin.mjs --project <id> --uid <uid> [--revoke]');
  }
  const isEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
  if (project.startsWith('demo-') && !isEmulator) {
    throw new Error('A demo-* project only exists in the emulators: set FIRESTORE_EMULATOR_HOST.');
  }
  if (!isEmulator && !confirmedReal) {
    throw new Error(
      `This would write to the REAL project "${project}". Re-run with --yes-real-project to confirm.`,
    );
  }

  const sdk = await loadAdminSdk();
  sdk.initializeApp({ projectId: project });

  // Refuse to grant to an account that does not exist or never proved its e-mail.
  const account = await sdk.getAuth().getUser(uid);
  if (!revoke && !account.emailVerified) {
    throw new Error(`Account ${uid} has no verified e-mail: not granting.`);
  }

  const reference = sdk.getFirestore().doc(`platformAdmins/${uid}`);
  if (revoke) {
    await reference.delete();
  } else {
    await reference.set({ createdAt: sdk.FieldValue.serverTimestamp(), grantedBy: 'script' });
  }
  const target = isEmulator ? `${project} (emulator)` : `${project} (REAL PROJECT)`;
  process.stdout.write(
    `${revoke ? 'Revoked' : 'Granted'} platform admin for ${uid} on ${target}.\n`,
  );
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
