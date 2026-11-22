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
//   (add --email <address> when the sign-in account is already gone: see step 5)
//
// Always run it with --dry-run first and read what it would do. See scripts/admin-common.mjs
// for the safety pattern and for where the credentials come from (never from this repository).
//
// Against the emulators (safe; this is what the tests do):
//   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
//     node scripts/delete-account.mjs --project demo-glpweb --uid seed-cliente
//
// What it does, in this order:
//   1. /users/{uid}, its addresses and its history of acceptances (/acceptances): deleted.
//      The history is the proof that the person accepted each version of the terms and of the
//      privacy policy; it goes with the account. If a claim is open, export it first
//      (scripts/export-account.mjs) and keep that copy with the register of requests.
//   2. /platformAdmins/{uid}: deleted.
//   3. Every /distributors/{d}/members/{uid}: kept (orders and shifts will point at it), with the
//      name replaced by "Cuenta eliminada" and `active: false`.
//   4. Every distributor the account founded: suspended and unlisted (control document and
//      public flag), and the founder's name, phone and e-mail emptied in private/settings,
//      together with the RUC, the legal name and the record number. The text of a note of the
//      platform to the founder (private/review, PLAN 3.2) is deleted: it may talk about the RUC.
//      The public business data stays. DECIDE WITH THE PERSON FIRST what happens to the
//      distributor (privacy policy §7): if it should keep working, do not run this script yet.
//   5. Invitations (PLAN 3.2): every invitation tied to the e-mail of the account — still
//      waiting: deleted (an invitation without its e-mail would work for anyone with the link);
//      used or revoked: the e-mail emptied. Every invitation the account created stops working:
//      the rules honour an invitation only while its author is an active owner, and step 3
//      switches that member off (PLAN §11, 2026-10-16). The copy of its name (`invitedByName`)
//      still becomes "Cuenta eliminada", for whoever opens such a link. The e-mail comes
//      from the sign-in account; once that is gone, pass it with --email.
//   6. The log of the plant stock (PLAN 3.4): in every adjustment the account made, in any
//      distributor, the copy of its name (`authorName`) becomes "Cuenta eliminada". The
//      adjustment itself stays, as the record of how the stock changed (privacy policy §6), and
//      so does `authorUid`, like the uid of a membership or the `createdBy` of an invitation: a
//      code that no longer belongs to any account. The rules never let the app edit a movement;
//      only this procedure does.
//   7. The Firebase Auth account: deleted.
// Steps 1 to 5 are one atomic batch. Step 6 follows in batches of its own, because an account
// may have made more adjustments than one batch can hold; it runs before step 7, so if it stops
// halfway the account is still there and running the script again finishes it. The script can
// be run again: it tolerates what is already gone.
//
// What it cannot do: a session of that account that is still open keeps a valid token for up to
// one hour and could write a new profile, address or stock adjustment in that time (until step 3
// commits, an active member may still adjust the stock). RUN THE SCRIPT AGAIN AFTER
// ONE HOUR; it should report nothing left to delete.
import { pathToFileURL } from 'node:url';
import {
  allDocuments,
  isMissingAccount,
  loadAdminSdk,
  readArguments,
  requireUid,
  resolveTarget,
  runAsScript,
} from './admin-common.mjs';

export const DELETED_ACCOUNT_NAME = 'Cuenta eliminada';

/** Writes per batch when renaming the author of stock adjustments (a batch takes 500). */
const RENAME_BATCH_SIZE = 400;

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
      // The RUC of a natural person carries its identity document, and the legal name may be
      // the person's own: the verification data goes with the founder (PLAN 2.11).
      taxId: '',
      legalName: '',
      hydrocarbonsRegistry: '',
      founderDeletedAt: now,
      updatedAt: now,
    });
  }
}

/** The address invitations are tied to: lowercase, as the app stores it (`normalizeInviteEmail`). */
async function emailOf(sdk, uid, typed) {
  if (typed) {
    if (!/^[^@\s]+@[^@\s]+$/.test(typed)) throw new Error(`--email "${typed}" is not an address.`);
    return typed.trim().toLowerCase();
  }
  try {
    const user = await sdk.getAuth().getUser(uid);
    return user.email ? user.email.toLowerCase() : null;
  } catch (error) {
    if (isMissingAccount(error)) return null;
    throw error;
  }
}

/** Invitations tied to the address, and the ones the account created (both capped). */
async function invitationsOf(db, uid, email) {
  const [forEmail, created] = await Promise.all([
    email === null
      ? { docs: [] }
      : db.collectionGroup('invites').where('email', '==', email).limit(500).get(),
    db.collectionGroup('invites').where('createdBy', '==', uid).limit(500).get(),
  ]);
  return { forEmail: forEmail.docs, created: created.docs };
}

function clearInvitations({ batch, now }, invitations) {
  const deleted = [];
  const emptied = [];
  for (const invite of invitations.forEmail) {
    if (invite.data().status === 'pending') {
      batch.delete(invite.ref);
      deleted.push(invite.ref.path);
    } else {
      batch.update(invite.ref, { email: null, updatedAt: now });
      emptied.push(invite.ref.path);
    }
  }
  const renamed = invitations.created
    .filter((invite) => typeof invite.data().invitedByName === 'string')
    .filter((invite) => !deleted.includes(invite.ref.path));
  for (const invite of renamed) {
    batch.update(invite.ref, { invitedByName: DELETED_ACCOUNT_NAME });
  }
  return { deleted, emptied, renamed: renamed.map((invite) => invite.ref.path) };
}

/** Adjustments of the plant stock made by the account that still carry its name. */
async function namedStockMovementsOf(db, uid) {
  const movements = await allDocuments(
    db.collectionGroup('stockMovements').where('authorUid', '==', uid),
  );
  return movements.filter((movement) => movement.data().authorName !== DELETED_ACCOUNT_NAME);
}

/** Replaces the author's name in each movement, in batches: the movement itself stays. */
async function renameStockMovementAuthor(db, movements) {
  for (let start = 0; start < movements.length; start += RENAME_BATCH_SIZE) {
    const batch = db.batch();
    for (const movement of movements.slice(start, start + RENAME_BATCH_SIZE)) {
      batch.update(movement.ref, { authorName: DELETED_ACCOUNT_NAME });
    }
    await batch.commit();
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
export async function deleteAccount(sdk, uid, { dryRun = false, email: typedEmail = null } = {}) {
  const db = sdk.getFirestore();
  const email = await emailOf(sdk, uid, typedEmail);
  const profileRef = db.doc(`users/${uid}`);
  const [profile, addresses, acceptances, memberships, adminGrant] = await Promise.all([
    profileRef.get(),
    profileRef.collection('addresses').get(),
    profileRef.collection('acceptances').get(),
    db.collectionGroup('members').where('uid', '==', uid).get(),
    db.doc(`platformAdmins/${uid}`).get(),
  ]);
  const founded = await foundedDistributorIds(db, uid, profile, memberships);
  const invitations = await invitationsOf(db, uid, email);
  const stockMovements = await namedStockMovementsOf(db, uid);

  const batch = db.batch();
  const now = sdk.FieldValue.serverTimestamp();
  const suspended = [];
  for (const distributorId of founded) {
    const base = `distributors/${distributorId}`;
    const [publicProfile, settings, review] = await Promise.all([
      db.doc(base).get(),
      db.doc(`${base}/private/settings`).get(),
      db.doc(`${base}/private/review`).get(),
    ]);
    const existing = { profile: publicProfile.exists, settings: settings.exists };
    suspendDistributor({ sdk, db, batch }, distributorId, existing);
    if (review.exists) batch.delete(review.ref);
    suspended.push({
      distributorId,
      reviewNoteDeleted: review.exists,
      otherActiveMembers: await otherActiveMembers(db, distributorId, uid),
    });
  }
  const invites = clearInvitations({ batch, now }, invitations);
  for (const member of memberships.docs) {
    batch.update(member.ref, { displayName: DELETED_ACCOUNT_NAME, active: false, updatedAt: now });
  }
  for (const address of addresses.docs) batch.delete(address.ref);
  for (const acceptance of acceptances.docs) batch.delete(acceptance.ref);
  if (profile.exists) batch.delete(profileRef);
  if (adminGrant.exists) batch.delete(adminGrant.ref);

  if (!dryRun) {
    await batch.commit();
    await renameStockMovementAuthor(db, stockMovements);
  }
  return {
    uid,
    dryRun,
    profileDeleted: profile.exists,
    addressesDeleted: addresses.size,
    acceptancesDeleted: acceptances.size,
    platformAdminRevoked: adminGrant.exists,
    membershipsAnonymised: memberships.docs.map((member) => member.ref.path),
    distributorsSuspended: suspended,
    email,
    invitationsDeleted: invites.deleted,
    invitationsEmptied: invites.emptied,
    invitationsRenamed: invites.renamed,
    stockMovementsRenamed: stockMovements.map((movement) => movement.ref.path),
    authAccount: dryRun ? 'not touched (dry run)' : await deleteAuthAccount(sdk, uid),
  };
}

function describe(summary, label) {
  const verb = summary.dryRun ? 'WOULD BE' : 'was';
  const lines = [
    `${summary.dryRun ? 'DRY RUN — nothing was written. ' : ''}Account ${summary.uid} on ${label}:`,
    `  profile ${verb} deleted: ${summary.profileDeleted ? 'yes' : 'there was none'}`,
    `  addresses deleted: ${summary.addressesDeleted}`,
    `  history of acceptances, entries deleted: ${summary.acceptancesDeleted}`,
    `  platform admin grant removed: ${summary.platformAdminRevoked ? 'yes' : 'there was none'}`,
    `  memberships anonymised and deactivated: ${summary.membershipsAnonymised.length}`,
    ...summary.membershipsAnonymised.map((path) => `    - ${path}`),
    `  distributors suspended, unlisted and stripped of the founder's data: ${summary.distributorsSuspended.length}`,
    ...summary.distributorsSuspended.map(
      ({ distributorId, otherActiveMembers: others, reviewNoteDeleted }) =>
        `    - ${distributorId} (${others} other active member(s) are left with a read-only distributor${reviewNoteDeleted ? '; note of the platform deleted' : ''})`,
    ),
    summary.email === null
      ? '  invitations tied to its e-mail: UNKNOWN — no sign-in account left; re-run with --email'
      : `  waiting invitations tied to its e-mail, deleted: ${summary.invitationsDeleted.length}`,
    ...summary.invitationsDeleted.map((path) => `    - ${path}`),
    `  used or revoked invitations, e-mail emptied: ${summary.invitationsEmptied.length}`,
    ...summary.invitationsEmptied.map((path) => `    - ${path}`),
    `  invitations it created, its name replaced: ${summary.invitationsRenamed.length}`,
    `  stock adjustments it made, its name replaced: ${summary.stockMovementsRenamed.length}`,
    `  sign-in account: ${summary.authAccount}`,
  ];
  if (!summary.dryRun) {
    lines.push(
      'Run this script again after one hour: a session that was still open could have written',
      'a new profile, address, acceptance or stock adjustment meanwhile. It should then report',
      'nothing left to delete.',
    );
  }
  return `${lines.join('\n')}\n`;
}

async function main(argv) {
  const options = readArguments(argv, {
    values: ['project', 'uid', 'email'],
    flags: ['dry-run', 'yes-real-project'],
  });
  const target = resolveTarget({
    project: options.project,
    confirmedReal: options['yes-real-project'],
  });
  // Never delete by an e-mail typed from memory: only a uid copied from the console passes.
  const uid = requireUid(options.uid);
  const sdk = await loadAdminSdk(options.project);
  const summary = await deleteAccount(sdk, uid, {
    dryRun: options['dry-run'],
    email: options.email,
  });
  process.stdout.write(describe(summary, target.label));
}

const isCommandLine =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isCommandLine) runAsScript(main);
