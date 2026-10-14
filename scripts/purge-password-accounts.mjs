// Account cleanup for sign-in with Google only (docs/PLAN.md 2.1 and 2.10). The app has no
// screen for a password and the password provider is disabled in the Firebase console, so a
// password is of no use to anybody: this script removes what is left of it and, when asked, ends
// every open session so that each one has to start again through Google.
//
// It is a manual, local procedure for the person responsible for the platform, like the other
// scripts here; see scripts/admin-common.mjs for the safety pattern and for where the
// credentials come from (never from this repository).
//
//   node scripts/purge-password-accounts.mjs --project <project-id>
//       a rehearsal, the default: says what it would do and writes nothing
//   node scripts/purge-password-accounts.mjs --project <project-id> --delete
//       applies the cleanup described below
//   node scripts/purge-password-accounts.mjs --project <project-id> --revoke-all
//       ends the sessions of every account that remains (both flags can go together)
//   A real project also needs --yes-real-project, rehearsal included.
//
// Against the emulators (safe; this is what the tests do):
//   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
//     node scripts/purge-password-accounts.mjs --project demo-glpweb
//
// What --delete does, account by account:
//   - ONLY a password, no profile in Firestore, no role anywhere: sessions revoked, account
//     deleted;
//   - ONLY a password and a role (a document in /platformAdmins or any membership): never
//     deleted, only reported, sessions revoked. A role is removed on purpose, by its own script;
//   - ONLY a password WITH a profile (/users/{uid}): never deleted, only reported, sessions
//     revoked. Its data is removed with scripts/delete-account.mjs, one account at a time, after
//     deciding what happens to anything it founded;
//   - Google AND a password: the password is unlinked and the sessions revoked; the account
//     stays, and enters with Google;
//   - no provider at all (none should exist): reported and left alone.
// --revoke-all then revokes the refresh tokens of every account left, Google ones included.
// It can be run again: what is already gone is not there to touch.
import { pathToFileURL } from 'node:url';
import {
  isMissingAccount,
  loadAdminSdk,
  readArguments,
  resolveTarget,
  runAsScript,
} from './admin-common.mjs';

const PASSWORD_PROVIDER = 'password';
const GOOGLE_PROVIDER = 'google.com';
/** The most accounts Firebase Auth hands over per page. */
const PAGE_SIZE = 1000;

async function listAllAccounts(auth) {
  const accounts = [];
  let pageToken;
  do {
    const page = await auth.listUsers(PAGE_SIZE, pageToken);
    accounts.push(...page.users);
    pageToken = page.pageToken;
  } while (pageToken);
  return accounts;
}

const providersOf = (account) => account.providerData.map((provider) => provider.providerId);

function isPasswordOnly(account) {
  const providers = providersOf(account);
  return providers.length > 0 && providers.every((provider) => provider === PASSWORD_PROVIDER);
}

function hasGoogleAndPassword(account) {
  const providers = providersOf(account);
  return providers.includes(PASSWORD_PROVIDER) && providers.includes(GOOGLE_PROVIDER);
}

const describeAccount = (account) => ({ uid: account.uid, email: account.email ?? null });

/** Calls `act`; an account that is already gone needs nothing. */
async function onAccount(act) {
  try {
    await act();
  } catch (error) {
    if (!isMissingAccount(error)) throw error;
  }
}

/** Whether the account holds a role: platform admin or member of any distributor. */
async function holdsRole(db, uid) {
  const [admin, memberships] = await Promise.all([
    db.doc(`platformAdmins/${uid}`).get(),
    db.collectionGroup('members').where('uid', '==', uid).limit(1).get(),
  ]);
  return admin.exists || !memberships.empty;
}

/** Sorts the password-only accounts into removable, holding a role, and holding a profile. */
async function classifyPasswordOnly(db, accounts) {
  const looked = await Promise.all(
    accounts.map(async (account) => ({
      account,
      role: await holdsRole(db, account.uid),
      profile: (await db.doc(`users/${account.uid}`).get()).exists,
    })),
  );
  return {
    removable: looked.filter(({ role, profile }) => !role && !profile).map((it) => it.account),
    withRole: looked.filter(({ role }) => role).map((it) => it.account),
    withProfile: looked.filter(({ role, profile }) => !role && profile).map((it) => it.account),
  };
}

async function applyCleanup(auth, { removable, withRole, withProfile, googleWithPassword }) {
  for (const { uid } of removable) {
    await onAccount(async () => {
      await auth.revokeRefreshTokens(uid);
      await auth.deleteUser(uid);
    });
  }
  for (const { uid } of [...withRole, ...withProfile]) {
    await onAccount(() => auth.revokeRefreshTokens(uid));
  }
  for (const { uid } of googleWithPassword) {
    await onAccount(async () => {
      await auth.updateUser(uid, { providersToUnlink: [PASSWORD_PROVIDER] });
      await auth.revokeRefreshTokens(uid);
    });
  }
}

/**
 * Looks at every account and, with `apply`, cleans up what a password left behind; with
 * `revokeAll`, ends the sessions of every account that remains. Without either nothing is
 * written. Returns what it found: `deleted` (or, in a rehearsal, what would be), `withRole` and
 * `withProfile` (password only, kept), `googleWithPassword` (password unlinked), `withoutProvider`
 * (never touched), `revoked` (accounts whose sessions --revoke-all ends) and `total`.
 */
export async function purgePasswordAccounts(sdk, { apply = false, revokeAll = false } = {}) {
  const auth = sdk.getAuth();
  const db = sdk.getFirestore();
  const accounts = await listAllAccounts(auth);
  const sorted = await classifyPasswordOnly(db, accounts.filter(isPasswordOnly));
  const googleWithPassword = accounts.filter(hasGoogleAndPassword);
  if (apply) await applyCleanup(auth, { ...sorted, googleWithPassword });
  const deleted = new Set(apply ? sorted.removable.map((account) => account.uid) : []);
  const remaining = accounts.filter((account) => !deleted.has(account.uid));
  if (revokeAll) {
    for (const { uid } of remaining) await onAccount(() => auth.revokeRefreshTokens(uid));
  }
  return {
    applied: apply,
    revokedAll: revokeAll,
    total: accounts.length,
    deleted: sorted.removable.map(describeAccount),
    withRole: sorted.withRole.map(describeAccount),
    withProfile: sorted.withProfile.map(describeAccount),
    googleWithPassword: googleWithPassword.map(describeAccount),
    withoutProvider: accounts
      .filter((account) => account.providerData.length === 0)
      .map(describeAccount),
    revoked: remaining.length,
  };
}

function listOf(accounts) {
  if (accounts.length === 0) return ['    (none)'];
  return accounts.map((account) => `    ${account.uid}  ${account.email ?? '(no e-mail)'}`);
}

function report(summary, label) {
  const done = summary.applied;
  const lines = [
    `${done ? 'Cleanup' : 'REHEARSAL (nothing was changed)'} on ${label}:`,
    `  accounts looked at: ${summary.total}`,
    `  ${done ? 'Sessions revoked and account deleted' : 'WOULD BE DELETED'} — password only, no profile, no role: ${summary.deleted.length}`,
    ...listOf(summary.deleted),
    `  Kept, ${done ? 'sessions revoked' : 'sessions would be revoked'} — password only, holds a role (platform admin or member): ${summary.withRole.length}`,
    ...listOf(summary.withRole),
    `  Kept, ${done ? 'sessions revoked' : 'sessions would be revoked'} — password only WITH a profile (use scripts/delete-account.mjs): ${summary.withProfile.length}`,
    ...listOf(summary.withProfile),
    `  ${done ? 'Password unlinked and sessions revoked' : 'PASSWORD WOULD BE UNLINKED'} — enter with Google and also hold a password: ${summary.googleWithPassword.length}`,
    ...listOf(summary.googleWithPassword),
    `  Left alone — no sign-in provider at all: ${summary.withoutProvider.length}`,
    ...listOf(summary.withoutProvider),
  ];
  if (summary.revokedAll) {
    lines.push(`  Sessions revoked of every account that remains: ${summary.revoked}`);
  }
  if (!done) lines.push('Run it again with --delete to apply the cleanup.');
  if (!summary.revokedAll)
    lines.push('Add --revoke-all to end the sessions of every account left.');
  return `${lines.join('\n')}\n`;
}

async function main(argv) {
  const options = readArguments(argv, {
    values: ['project'],
    flags: ['delete', 'revoke-all', 'yes-real-project'],
  });
  const target = resolveTarget({
    project: options.project,
    confirmedReal: options['yes-real-project'],
  });
  const sdk = await loadAdminSdk(options.project);
  const summary = await purgePasswordAccounts(sdk, {
    apply: options.delete,
    revokeAll: options['revoke-all'],
  });
  process.stdout.write(report(summary, target.label));
}

const isCommandLine =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isCommandLine) runAsScript(main);
