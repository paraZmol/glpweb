// Deletes one account and removes or anonymises its personal data (docs/PLAN.md 2.10, privacy
// policy §6 and §7). The app cannot do this: the security rules do not let a profile be deleted
// and nobody but a platform procedure may touch the documents of other distributors.
//
// It is a manual, local procedure for the person responsible for the data, run only after a
// request was received and the identity of the person was confirmed. Write the request down in
// the register of requests (kept outside this repository) before running it.
//
//   node scripts/delete-account.mjs --project <project-id> --uid <uid> --dry-run
//   node scripts/delete-account.mjs --project <project-id> --uid <uid> --yes-real-project
//
// Always run it with --dry-run first and read what it would do. See scripts/admin-common.mjs
// for the safety pattern and for where the credentials come from (never from this repository).
//
// Against the emulators (safe; this is what the tests do):
//   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
//     node scripts/delete-account.mjs --project demo-glpweb --uid seed-cliente
//
// What it does, in this order:
//   1. /users/{uid} and its addresses: deleted.
//   2. /platformAdmins/{uid}: deleted.
//   3. Every /distributors/{d}/members/{uid}: kept (orders and shifts will point at it), with the
//      name replaced by "Cuenta eliminada" and `active: false`.
//   4. Every distributor the account founded: suspended and unlisted (control document and
//      public flag), and the founder's name, phone and e-mail emptied in private/settings. The
//      business data stays. DECIDE WITH THE PERSON FIRST what happens to the distributor
//      (privacy policy §7): if it should keep working, do not run this script yet.
//   5. The Firebase Auth account: deleted.
// Steps 1 to 4 are one atomic batch. The script can be run again: it tolerates what is already
// gone.
//
// What it cannot do: a session of that account that is still open keeps a valid token for up to
// one hour and could write a new profile or address in that time. RUN THE SCRIPT AGAIN AFTER
// ONE HOUR; it should report nothing left to delete.
import { pathToFileURL } from 'node:url';
import {
  isMissingAccount,
  loadAdminSdk,
  readArguments,
  resolveTarget,
  runAsScript,
} from './admin-common.mjs';

export const DELETED_ACCOUNT_NAME = 'Cuenta eliminada';

/** Ids of the distributors the account founded, from its profile and from its owner roles. */
async function foundedDistributorIds(db, uid, profile, memberships) {
  const claimed = profile.exists ? (profile.data().ownedDistributorIds ?? []) : [];
  const owned = memberships.docs
    .filter((member) => member.data().role === 'owner')
    .map((member) => member.data().distributorId);
  const candidates = [...new Set([...claimed, ...owned])].filter((id) => typeof id === 'string');
  const controls = await Promise.all(
    candidates.map((id) => db.doc(`distributors/${id}/private/control`).get()),
  );
  return candidates.filter((_, index) => controls[index].data()?.ownerUid === uid);
}

/** Staff other than the founder, so the summary says who is left in a suspended distributor. */
async function otherActiveMembers(db, distributorId, uid) {
  const members = await db.collection(`distributors/${distributorId}/members`).limit(100).get();
  return members.docs.filter((member) => member.id !== uid && member.data().active === true).length;
}

function suspendDistributor({ sdk, db, batch }, distributorId, existing) {
  const now = sdk.FieldValue.serverTimestamp();
  const base = `distributors/${distributorId}`;
  batch.update(db.doc(`${base}/private/control`), { status: 'suspended', updatedAt: now });
  if (existing.profile) batch.update(db.doc(base), { acceptingOrders: false, updatedAt: now });
  if (existing.settings) {
    batch.update(db.doc(`${base}/private/settings`), {
      ownerName: DELETED_ACCOUNT_NAME,
      ownerPhone: '',
      ownerEmail: '',
      founderDeletedAt: now,
      updatedAt: now,
    });
  }
}

async function deleteAuthAccount(sdk, uid) {
  try {
    await sdk.getAuth().deleteUser(uid);
    return 'deleted';
  } catch (error) {
    if (isMissingAccount(error)) return 'already gone';
    throw error;
  }
}

/**
 * Deletes or anonymises everything of `uid`. With `dryRun` nothing is written and the summary
 * says what would be done. Returns the summary.
 */
export async function deleteAccount(sdk, uid, { dryRun = false } = {}) {
  const db = sdk.getFirestore();
  const profileRef = db.doc(`users/${uid}`);
  const [profile, addresses, memberships, adminGrant] = await Promise.all([
    profileRef.get(),
    profileRef.collection('addresses').get(),
    db.collectionGroup('members').where('uid', '==', uid).get(),
    db.doc(`platformAdmins/${uid}`).get(),
  ]);
  const founded = await foundedDistributorIds(db, uid, profile, memberships);

  const batch = db.batch();
  const now = sdk.FieldValue.serverTimestamp();
  const suspended = [];
  for (const distributorId of founded) {
    const base = `distributors/${distributorId}`;
    const [publicProfile, settings] = await Promise.all([
      db.doc(base).get(),
      db.doc(`${base}/private/settings`).get(),
    ]);
    const existing = { profile: publicProfile.exists, settings: settings.exists };
    suspendDistributor({ sdk, db, batch }, distributorId, existing);
    suspended.push({
      distributorId,
      otherActiveMembers: await otherActiveMembers(db, distributorId, uid),
    });
  }
  for (const member of memberships.docs) {
    batch.update(member.ref, { displayName: DELETED_ACCOUNT_NAME, active: false, updatedAt: now });
  }
  for (const address of addresses.docs) batch.delete(address.ref);
  if (profile.exists) batch.delete(profileRef);
  if (adminGrant.exists) batch.delete(adminGrant.ref);

  if (!dryRun) await batch.commit();
  return {
    uid,
    dryRun,
    profileDeleted: profile.exists,
    addressesDeleted: addresses.size,
    platformAdminRevoked: adminGrant.exists,
    membershipsAnonymised: memberships.docs.map((member) => member.ref.path),
    distributorsSuspended: suspended,
    authAccount: dryRun ? 'not touched (dry run)' : await deleteAuthAccount(sdk, uid),
  };
}

function describe(summary, label) {
  const verb = summary.dryRun ? 'WOULD BE' : 'was';
  const lines = [
    `${summary.dryRun ? 'DRY RUN — nothing was written. ' : ''}Account ${summary.uid} on ${label}:`,
    `  profile ${verb} deleted: ${summary.profileDeleted ? 'yes' : 'there was none'}`,
    `  addresses deleted: ${summary.addressesDeleted}`,
    `  platform admin grant removed: ${summary.platformAdminRevoked ? 'yes' : 'there was none'}`,
    `  memberships anonymised and deactivated: ${summary.membershipsAnonymised.length}`,
    ...summary.membershipsAnonymised.map((path) => `    - ${path}`),
    `  distributors suspended, unlisted and stripped of the founder's data: ${summary.distributorsSuspended.length}`,
    ...summary.distributorsSuspended.map(
      ({ distributorId, otherActiveMembers: others }) =>
        `    - ${distributorId} (${others} other active member(s) are left with a read-only distributor)`,
    ),
    `  sign-in account: ${summary.authAccount}`,
  ];
  if (!summary.dryRun) {
    lines.push(
      'Run this script again after one hour: a session that was still open could have written',
      'a new profile or address meanwhile. It should then report nothing left to delete.',
    );
  }
  return `${lines.join('\n')}\n`;
}

async function main(argv) {
  const options = readArguments(argv, {
    values: ['project', 'uid'],
    flags: ['dry-run', 'yes-real-project'],
  });
  const target = resolveTarget({
    project: options.project,
    confirmedReal: options['yes-real-project'],
  });
  if (!options.uid)
    throw new Error('Missing --uid <uid>. Never delete by an e-mail typed from memory.');
  const sdk = await loadAdminSdk(options.project);
  const summary = await deleteAccount(sdk, options.uid, { dryRun: options['dry-run'] });
  process.stdout.write(describe(summary, target.label));
}

const isCommandLine =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isCommandLine) runAsScript(main);
