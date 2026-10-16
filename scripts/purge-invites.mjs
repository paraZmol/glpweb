// Clears the e-mail of invitations of staff that no longer need it (docs/PLAN.md §11, 2026-10-16;
// privacy policy §6 and §7). An invitation keeps the address an owner typed only so that one
// Google account can use it; once it can no longer be used, the address has no purpose.
//
// It is a manual, local procedure for the person responsible for the data, like the other
// scripts here; see scripts/admin-common.mjs for the safety pattern and for where the
// credentials come from (never from this repository).
//
//   node scripts/purge-invites.mjs --project <project-id> --dry-run
//       says what it would do and writes nothing
//   node scripts/purge-invites.mjs --project <project-id>
//       retention: clears the e-mail of every invitation that expired, was used or was revoked
//       more than 30 days ago (INVITE_EMAIL_RETENTION_DAYS)
//   node scripts/purge-invites.mjs --project <project-id> --email <address>
//       a request of the person (with or without an account in Hornilla): every invitation
//       tied to that address, whatever its age — still waiting: deleted (an invitation without
//       its e-mail would work for anyone with the link); used, revoked or expired: e-mail cleared
//   A real project also needs --yes-real-project, dry run included. Write a request down in the
//   register of requests (kept outside this repository) before running it with --email.
//
// Against the emulators (safe; this is what the tests do):
//   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
//     node scripts/purge-invites.mjs --project demo-glpweb
//
// Accepting an invitation already clears its e-mail (the rules demand it), so the retention run
// finds the ones that expired or were revoked, and any used before that rule. It can be run
// again: an invitation without an e-mail is not looked at. One batch of at most 500 per run:
// run it again until it reports nothing.
import { pathToFileURL } from 'node:url';
import { loadAdminSdk, readArguments, resolveTarget, runAsScript } from './admin-common.mjs';

/** Days an invitation keeps its e-mail once it cannot be used any more. */
export const INVITE_EMAIL_RETENTION_DAYS = 30;
/** INVITE_TTL_DAYS of src/domain/staff/constants.ts: the rules count it from createdAt. */
const INVITE_TTL_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;
const BATCH_LIMIT = 500;

const millisOf = (timestamp) =>
  timestamp && typeof timestamp.toMillis === 'function' ? timestamp.toMillis() : null;

/**
 * When the invitation stopped being usable, in milliseconds, or null while it still can be
 * used (or its dates are missing: then it is left alone).
 */
export function closedAtOf(invite, nowMs) {
  if (invite.status === 'accepted') return millisOf(invite.acceptedAt);
  if (invite.status === 'revoked') return millisOf(invite.revokedAt);
  const createdAt = millisOf(invite.createdAt);
  if (createdAt === null) return null;
  const expiresAt = createdAt + INVITE_TTL_DAYS * DAY_MS;
  return expiresAt <= nowMs ? expiresAt : null;
}

/** Whether the e-mail of the invitation is past its retention. */
export function isPastRetention(invite, nowMs) {
  const closedAt = closedAtOf(invite, nowMs);
  return closedAt !== null && closedAt + INVITE_EMAIL_RETENTION_DAYS * DAY_MS <= nowMs;
}

function normalizedEmail(typed) {
  const email = typed.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+$/.test(email)) throw new Error(`--email "${typed}" is not an address.`);
  return email;
}

/**
 * Clears what applies and returns the summary. With `email`, the invitations tied to it; without
 * it, the ones past their retention. With `dryRun` nothing is written.
 */
export async function purgeInvites(sdk, { dryRun = false, email = null, now = new Date() } = {}) {
  const db = sdk.getFirestore();
  const invites = db.collectionGroup('invites');
  const address = email === null ? null : normalizedEmail(email);
  const query =
    address === null ? invites.where('email', '!=', null) : invites.where('email', '==', address);
  const found = (await query.limit(BATCH_LIMIT).get()).docs;
  const nowMs = now.getTime();
  const batch = db.batch();
  const stamp = sdk.FieldValue.serverTimestamp();
  const deleted = [];
  const emptied = [];
  for (const invite of found) {
    const data = invite.data();
    if (address !== null && data.status === 'pending' && closedAtOf(data, nowMs) === null) {
      batch.delete(invite.ref);
      deleted.push(invite.ref.path);
    } else if (address !== null || isPastRetention(data, nowMs)) {
      batch.update(invite.ref, { email: null, updatedAt: stamp });
      emptied.push(invite.ref.path);
    }
  }
  if (!dryRun && deleted.length + emptied.length > 0) await batch.commit();
  return { dryRun, email: address, looked: found.length, deleted, emptied };
}

function describe(summary, label) {
  const verb = summary.dryRun ? 'WOULD BE' : 'were';
  const scope =
    summary.email === null
      ? `invitations whose e-mail is past ${INVITE_EMAIL_RETENTION_DAYS} days of retention`
      : `invitations tied to ${summary.email}`;
  const lines = [
    `${summary.dryRun ? 'DRY RUN — nothing was written. ' : ''}${scope}, on ${label}:`,
    `  invitations with an e-mail looked at: ${summary.looked}`,
    `  waiting invitations ${verb} deleted: ${summary.deleted.length}`,
    ...summary.deleted.map((path) => `    - ${path}`),
    `  invitations whose e-mail ${verb} cleared: ${summary.emptied.length}`,
    ...summary.emptied.map((path) => `    - ${path}`),
  ];
  if (summary.looked === BATCH_LIMIT) lines.push('  More may be left: run it again.');
  return `${lines.join('\n')}\n`;
}

async function main(argv) {
  const options = readArguments(argv, {
    values: ['project', 'email'],
    flags: ['dry-run', 'yes-real-project'],
  });
  const target = resolveTarget({
    project: options.project,
    confirmedReal: options['yes-real-project'],
  });
  const sdk = await loadAdminSdk(options.project);
  const summary = await purgeInvites(sdk, {
    dryRun: options['dry-run'],
    email: options.email ?? null,
  });
  process.stdout.write(describe(summary, target.label));
}

const isCommandLine =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isCommandLine) runAsScript(main);
