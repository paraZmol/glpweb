// Exports everything stored about one account as JSON (docs/PLAN.md 2.10, privacy policy §7:
// right of access). A manual, local procedure for the person responsible for the data, run
// only after a request was received and the identity of the person was confirmed.
//
//   node scripts/export-account.mjs --project <project-id> --uid <uid> --yes-real-project \
//     --out <path outside this repository>
//
// Without --out the JSON goes to standard output. THE RESULT IS PERSONAL DATA: the script
// refuses an --out inside this repository (it is public); send the file only to the person it
// belongs to and delete your copy afterwards. See scripts/admin-common.mjs for the safety pattern and for where the
// credentials come from.
//
// Against the emulators (safe; this is what the tests do):
//   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
//     node scripts/export-account.mjs --project demo-glpweb --uid seed-cliente
//
// What it includes: the sign-in account (e-mail, name, providers, dates; never the password),
// the profile, the addresses, every membership and, for each distributor the account founded,
// its public profile, its control document and its private settings. Orders and shifts will be
// added when those collections exist.
import { existsSync, realpathSync, writeFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  isMissingAccount,
  loadAdminSdk,
  readArguments,
  requireUid,
  resolveTarget,
  runAsScript,
  toPlainJson,
} from './admin-common.mjs';

const REPOSITORY_ROOT = realpathSync(join(dirname(fileURLToPath(import.meta.url)), '..'));

/** The real location of `path`, following links in the part of it that already exists. */
function realLocationOf(path) {
  const absolute = resolve(path);
  if (existsSync(absolute)) return realpathSync(absolute);
  const parent = dirname(absolute);
  return parent === absolute ? absolute : join(realLocationOf(parent), basename(absolute));
}

/**
 * Where the export will be written, or a refusal: never inside this repository, which is
 * public. One `git add` away from publishing somebody's personal data is too close.
 */
export function requireOutsideRepository(out, root = REPOSITORY_ROOT) {
  const target = realLocationOf(out);
  const fromRoot = relative(root, target);
  const isInside = fromRoot === '' || (!fromRoot.startsWith('..') && !isAbsolute(fromRoot));
  if (isInside) {
    throw new Error(
      `--out "${out}" is inside this repository, which is public: an export is personal data. ` +
        'Write it to a folder outside any git repository.',
    );
  }
  return target;
}

async function signInAccount(sdk, uid) {
  try {
    const user = await sdk.getAuth().getUser(uid);
    return {
      uid: user.uid,
      email: user.email ?? null,
      emailVerified: user.emailVerified,
      displayName: user.displayName ?? null,
      phoneNumber: user.phoneNumber ?? null,
      photoUrl: user.photoURL ?? null,
      disabled: user.disabled,
      providers: user.providerData.map((provider) => provider.providerId),
      createdAt: user.metadata.creationTime ?? null,
      lastSignInAt: user.metadata.lastSignInTime ?? null,
    };
  } catch (error) {
    if (isMissingAccount(error)) return null;
    throw error;
  }
}

async function foundedDistributor(db, distributorId) {
  const base = `distributors/${distributorId}`;
  const [profile, control, settings] = await Promise.all([
    db.doc(base).get(),
    db.doc(`${base}/private/control`).get(),
    db.doc(`${base}/private/settings`).get(),
  ]);
  return {
    distributorId,
    publicProfile: profile.data() ?? null,
    control: control.data() ?? null,
    privateSettings: settings.data() ?? null,
  };
}

/** Everything stored about `uid`, as plain JSON (timestamps as ISO text). */
export async function exportAccount(sdk, uid) {
  const db = sdk.getFirestore();
  const profileRef = db.doc(`users/${uid}`);
  const [account, profile, addresses, memberships, adminGrant] = await Promise.all([
    signInAccount(sdk, uid),
    profileRef.get(),
    profileRef.collection('addresses').get(),
    db.collectionGroup('members').where('uid', '==', uid).get(),
    db.doc(`platformAdmins/${uid}`).get(),
  ]);
  const owned = profile.data()?.ownedDistributorIds ?? [];
  const founded = await Promise.all(owned.map((id) => foundedDistributor(db, id)));
  return toPlainJson({
    exportedAt: new Date().toISOString(),
    uid,
    signInAccount: account,
    profile: profile.data() ?? null,
    addresses: addresses.docs.map((address) => ({ id: address.id, ...address.data() })),
    memberships: memberships.docs.map((member) => ({ path: member.ref.path, ...member.data() })),
    isPlatformAdmin: adminGrant.exists,
    foundedDistributors: founded.filter((entry) => entry.control?.ownerUid === uid),
  });
}

async function main(argv) {
  const options = readArguments(argv, {
    values: ['project', 'uid', 'out'],
    flags: ['yes-real-project'],
  });
  const target = resolveTarget({
    project: options.project,
    confirmedReal: options['yes-real-project'],
  });
  const uid = requireUid(options.uid);
  // Decided before anything is read: a refused destination costs no query.
  const out = options.out ? requireOutsideRepository(options.out) : null;
  const sdk = await loadAdminSdk(options.project);
  const json = `${JSON.stringify(await exportAccount(sdk, uid), null, 2)}\n`;
  if (out === null) {
    process.stdout.write(json);
    return;
  }
  writeFileSync(out, json);
  process.stderr.write(`Exported account ${uid} from ${target.label} to ${out}.\n`);
}

const isCommandLine =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isCommandLine) runAsScript(main);
