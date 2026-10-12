// Removes the sign-in accounts that can only enter with a password (docs/PLAN.md 2.1). Sign-in
// is with Google only: the app has no screen for a password and the password provider is
// disabled in the Firebase console, so such an account can no longer be used by anybody. This
// lists them and, when asked, revokes their sessions and deletes them from Firebase Auth.
//
// It is a manual, local procedure for the person responsible for the platform, like the other
// scripts here; see scripts/admin-common.mjs for the safety pattern and for where the
// credentials come from (never from this repository).
//
//   node scripts/purge-password-accounts.mjs --project <project-id>
//       a rehearsal, the default: says what it would delete and deletes nothing
//   node scripts/purge-password-accounts.mjs --project <project-id> --delete
//       deletes them. A real project also needs --yes-real-project, rehearsal included
//
// Against the emulators (safe; this is what the tests do):
//   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
//     node scripts/purge-password-accounts.mjs --project demo-glpweb
//
// What it touches, and what it leaves alone:
//   - an account whose ONLY sign-in provider is the password, and that has no profile in
//     Firestore: its sessions are revoked and the account is deleted;
//   - the same kind of account WITH a profile (/users/{uid}) is only reported: it has data, and
//     data is removed with scripts/delete-account.mjs, one account at a time, after deciding
//     what happens to anything it founded;
//   - an account that enters with Google is never touched, also when it has a password besides
//     (it is reported: the password is useless while the provider stays disabled);
//   - an account with no provider at all (none should exist) is reported and left alone.
// It can be run again: what is already gone is not there to delete.
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

function hasUselessPassword(account) {
  const providers = providersOf(account);
  return providers.includes(PASSWORD_PROVIDER) && providers.includes(GOOGLE_PROVIDER);
}

const describeAccount = (account) => ({ uid: account.uid, email: account.email ?? null });

/** Ends the sessions of the account and deletes it; one that is already gone needs nothing. */
async function removeAccount(auth, uid) {
  try {
    await auth.revokeRefreshTokens(uid);
    await auth.deleteUser(uid);
  } catch (error) {
    if (!isMissingAccount(error)) throw error;
  }
}

/**
 * Finds the accounts that can only enter with a password and, with `apply`, removes the ones
 * that hold no data. Without `apply` nothing is written. Returns what it found:
 * `deleted` (or, in a rehearsal, what would be), `withProfile` (left for delete-account.mjs),
 * `googleWithPassword` and `withoutProvider` (never touched), and `total` accounts looked at.
 */
export async function purgePasswordAccounts(sdk, { apply = false } = {}) {
  const auth = sdk.getAuth();
  const db = sdk.getFirestore();
  const accounts = await listAllAccounts(auth);
  const passwordOnly = accounts.filter(isPasswordOnly);
  const profiles = await Promise.all(
    passwordOnly.map((account) => db.doc(`users/${account.uid}`).get()),
  );
  const removable = passwordOnly.filter((_, index) => !profiles[index].exists);
  if (apply) {
    for (const account of removable) await removeAccount(auth, account.uid);
  }
  return {
    applied: apply,
    total: accounts.length,
    deleted: removable.map(describeAccount),
    withProfile: passwordOnly.filter((_, index) => profiles[index].exists).map(describeAccount),
    googleWithPassword: accounts.filter(hasUselessPassword).map(describeAccount),
    withoutProvider: accounts
      .filter((account) => account.providerData.length === 0)
      .map(describeAccount),
  };
}

function listOf(accounts) {
  if (accounts.length === 0) return ['    (none)'];
  return accounts.map((account) => `    ${account.uid}  ${account.email ?? '(no e-mail)'}`);
}

function report(summary, label) {
  const verb = summary.applied ? 'Sessions revoked and account deleted' : 'WOULD BE DELETED';
  const lines = [
    `${summary.applied ? 'Purge' : 'REHEARSAL (nothing was deleted)'} on ${label}:`,
    `  accounts looked at: ${summary.total}`,
    `  ${verb} — password only, no profile: ${summary.deleted.length}`,
    ...listOf(summary.deleted),
    `  Left alone — password only WITH a profile (use scripts/delete-account.mjs): ${summary.withProfile.length}`,
    ...listOf(summary.withProfile),
    `  Left alone — enter with Google and also hold a password: ${summary.googleWithPassword.length}`,
    ...listOf(summary.googleWithPassword),
    `  Left alone — no sign-in provider at all: ${summary.withoutProvider.length}`,
    ...listOf(summary.withoutProvider),
  ];
  if (!summary.applied && summary.deleted.length > 0) {
    lines.push('Run it again with --delete to delete them.');
  }
  return `${lines.join('\n')}\n`;
}

async function main(argv) {
  const options = readArguments(argv, {
    values: ['project'],
    flags: ['delete', 'yes-real-project'],
  });
  const target = resolveTarget({
    project: options.project,
    confirmedReal: options['yes-real-project'],
  });
  const sdk = await loadAdminSdk(options.project);
  const summary = await purgePasswordAccounts(sdk, { apply: options.delete });
  process.stdout.write(report(summary, target.label));
}

const isCommandLine =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isCommandLine) runAsScript(main);
