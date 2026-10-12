// Approves the listing of a distributor, suspends it or reactivates it (docs/PLAN.md 2.11).
// The platform panel does the same from the app; this script is the way to do it when the panel
// is not at hand, or when a distributor must be taken down at once.
//
// It is a manual, local procedure for the person responsible for the platform. Find the id of
// the distributor in the panel or in the Firebase console; never act on a name typed from
// memory.
//
//   node scripts/set-distributor-status.mjs --project <id> --distributor <id> --action suspend --yes-real-project
//   node scripts/set-distributor-status.mjs --project <id> --distributor <id> --action reactivate --yes-real-project
//   node scripts/set-distributor-status.mjs --project <id> --distributor <id> --action approve \
//     --by <uid of the platform admin who reviewed it> --yes-real-project
//
// Add --dry-run to read what it would do without writing. See scripts/admin-common.mjs for the
// safety pattern and for where the credentials come from (never from this repository).
//
// Against the emulators (safe; this is what the tests do):
//   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
//     node scripts/set-distributor-status.mjs --project demo-glpweb --distributor seed-dist-e \
//       --action approve --by seed-admin
//
// What each action writes, always in ONE transaction over the control document and the public
// one, so the two never disagree (the security rules demand the same from the app):
//   approve     control: listingApproved true, approvedAt now, approvedBy <--by>, no reviewNote
//               and no correctedAt (the mark the owner leaves when it answers a note).
//               `--by` must be a platform admin: an approval always says who looked at it.
//   suspend     control: status 'suspended'. The approval is kept.
//   reactivate  control: status back to 'trial' while the trial still runs, else 'active'.
//   In the three, the public `acceptingOrders` becomes "may operate AND listing approved": that
//   flag is what lists the distributor and what lets visitors read its name and phones, so a
//   suspension hides them at once.
import { pathToFileURL } from 'node:url';
import {
  loadAdminSdk,
  readArguments,
  requireDistributorId,
  requireUid,
  resolveTarget,
  runAsScript,
} from './admin-common.mjs';

export const ACTIONS = ['approve', 'suspend', 'reactivate'];

/** Same condition as `isWritable` in src/domain/tenancy/status.ts. */
function mayOperate(control, now) {
  if (control.status === 'active') return true;
  return control.status === 'trial' && control.trialEndsAt.toDate().getTime() > now.getTime();
}

/** Same choice as `statusAfterReactivation` in src/domain/tenancy/listing.ts. */
function statusAfterReactivation(control, now) {
  return control.trialEndsAt.toDate().getTime() > now.getTime() ? 'trial' : 'active';
}

/** The control document after `action`, without the fields the action removes. */
function controlAfter(action, control, { by, now }) {
  if (action === 'suspend') return { ...control, status: 'suspended' };
  if (action === 'reactivate') {
    return { ...control, status: statusAfterReactivation(control, now) };
  }
  return { ...control, listingApproved: true, approvedBy: by };
}

function controlChange(sdk, action, after) {
  const now = sdk.FieldValue.serverTimestamp();
  if (action !== 'approve') return { status: after.status, updatedAt: now };
  return {
    listingApproved: true,
    approvedAt: now,
    approvedBy: after.approvedBy,
    reviewNote: sdk.FieldValue.delete(),
    correctedAt: sdk.FieldValue.delete(),
    updatedAt: now,
  };
}

async function requirePlatformAdmin(db, uid) {
  if (!(await db.doc(`platformAdmins/${uid}`).get()).exists) {
    throw new Error(`Account ${uid} is not a platform admin: an approval must be signed by one.`);
  }
}

/**
 * Applies `action` to one distributor. With `dryRun` nothing is written. Returns a summary:
 * `{ distributorId, action, dryRun, name, before, after }`, where `before` and `after` carry
 * `status`, `listingApproved` and `acceptingOrders`.
 */
export async function setDistributorStatus(
  sdk,
  distributorId,
  action,
  { by = null, dryRun = false, now = new Date() } = {},
) {
  if (!ACTIONS.includes(action)) {
    throw new Error(`Unknown --action "${action}": use one of ${ACTIONS.join(', ')}.`);
  }
  const db = sdk.getFirestore();
  if (action === 'approve') await requirePlatformAdmin(db, requireUid(by, 'by'));
  const controlRef = db.doc(`distributors/${distributorId}/private/control`);
  const profileRef = db.doc(`distributors/${distributorId}`);

  return db.runTransaction(async (tx) => {
    const [control, profile] = await Promise.all([tx.get(controlRef), tx.get(profileRef)]);
    if (!control.exists || !profile.exists) {
      throw new Error(`Distributor ${distributorId} does not exist in this project.`);
    }
    const before = control.data();
    const after = controlAfter(action, before, { by, now });
    const acceptingOrders = after.listingApproved === true && mayOperate(after, now);
    if (!dryRun) {
      tx.update(controlRef, controlChange(sdk, action, after));
      tx.update(profileRef, { acceptingOrders, updatedAt: sdk.FieldValue.serverTimestamp() });
    }
    const snapshotOf = (data, flag) => ({
      status: data.status,
      listingApproved: data.listingApproved === true,
      acceptingOrders: flag,
    });
    return {
      distributorId,
      action,
      dryRun,
      name: profile.data().name,
      before: snapshotOf(before, profile.data().acceptingOrders === true),
      after: snapshotOf(after, acceptingOrders),
    };
  });
}

function describeState({ status, listingApproved, acceptingOrders }) {
  const approval = listingApproved ? 'listing approved' : 'listing NOT approved';
  const visibility = acceptingOrders ? 'visible to the public' : 'hidden from the public';
  return `status ${status}, ${approval}, ${visibility}`;
}

function describe(summary, label) {
  const lead = summary.dryRun ? 'DRY RUN — nothing was written. ' : '';
  return [
    `${lead}${summary.action} on distributor ${summary.distributorId} ("${summary.name}") on ${label}:`,
    `  before: ${describeState(summary.before)}`,
    `  ${summary.dryRun ? 'would be' : 'now'}: ${describeState(summary.after)}`,
    '',
  ].join('\n');
}

async function main(argv) {
  const options = readArguments(argv, {
    values: ['project', 'distributor', 'action', 'by'],
    flags: ['dry-run', 'yes-real-project'],
  });
  const target = resolveTarget({
    project: options.project,
    confirmedReal: options['yes-real-project'],
  });
  const distributorId = requireDistributorId(options.distributor);
  if (!options.action) throw new Error(`Missing --action <${ACTIONS.join('|')}>.`);
  if (!ACTIONS.includes(options.action)) {
    throw new Error(`Unknown --action "${options.action}": use one of ${ACTIONS.join(', ')}.`);
  }
  if (options.action === 'approve') requireUid(options.by, 'by');
  const sdk = await loadAdminSdk(options.project);
  const summary = await setDistributorStatus(sdk, distributorId, options.action, {
    by: options.by,
    dryRun: options['dry-run'],
  });
  process.stdout.write(describe(summary, target.label));
}

const isCommandLine =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isCommandLine) runAsScript(main);
