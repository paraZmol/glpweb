// PLAN 2.1 and 2.10: sign-in is with Google only. The local script of the account cleanup, run as
// a person would run it, against the emulators of this lane.
import { execFile } from 'node:child_process';
import { beforeEach, describe, expect, it } from 'vitest';
import { EMULATOR_HOST, EMULATOR_PROJECT_ID, emulatorPorts } from '../../scripts/lane-ports.mjs';
import { googleIdOf, SEED_USERS } from '../seed/data';
import { seedEmulators } from '../seed/seed';

const ports = emulatorPorts();
const EMULATOR_ENV = {
  FIRESTORE_EMULATOR_HOST: `${EMULATOR_HOST}:${ports.firestore}`,
  FIREBASE_AUTH_EMULATOR_HOST: `${EMULATOR_HOST}:${ports.auth}`,
};
const ADMIN_HEADERS = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' };
const AUTH_API = `http://${EMULATOR_HOST}:${ports.auth}/identitytoolkit.googleapis.com/v1/projects/${EMULATOR_PROJECT_ID}`;
const DOCUMENTS = `http://${EMULATOR_HOST}:${ports.firestore}/v1/projects/${EMULATOR_PROJECT_ID}/databases/(default)/documents`;
const SCRIPT = 'scripts/purge-password-accounts.mjs';

interface Leftover {
  uid: string;
  email: string;
}

/** An account as the retired registration left it: a password and nothing else. */
const LEFTOVER = { uid: 'vieja-sin-perfil', email: 'vieja-sin-perfil@example.com' };
/** The same, but it got as far as having a profile: it holds data. */
const WITH_DATA = { uid: 'vieja-con-perfil', email: 'vieja-con-perfil@example.com' };
/** Only a password and no profile, but a member of a distributor. */
const MEMBER = { uid: 'vieja-miembro', email: 'vieja-miembro@example.com' };
/** Only a password and no profile, but a platform admin. */
const PLATFORM_ADMIN = { uid: 'vieja-plataforma', email: 'vieja-plataforma@example.com' };
/** Enters with Google and also holds a password. */
const BOTH = { uid: 'google-con-clave', email: 'google-con-clave@example.com' };
const LEFTOVERS: Leftover[] = [LEFTOVER, WITH_DATA, MEMBER, PLATFORM_ADMIN, BOTH];
const leftoverUids = LEFTOVERS.map((account) => account.uid);
const seededUids = Object.values(SEED_USERS).map((user) => user.uid);
/** A moment long before any test: a session started after it stays valid until it moves. */
const LONG_AGO_SECONDS = 1_600_000_000;

interface Run {
  code: number;
  stdout: string;
  stderr: string;
}

function run(args: string[], env: Record<string, string> = EMULATOR_ENV) {
  const withoutEmulators = Object.fromEntries(
    Object.entries(process.env).filter(([name]) => !name.includes('EMULATOR_HOST')),
  );
  return new Promise<Run>((resolve) => {
    execFile(
      process.execPath,
      [SCRIPT, ...args],
      { env: { ...withoutEmulators, ...env } },
      (error, stdout, stderr) => {
        const code = error && typeof error.code === 'number' ? error.code : error ? 1 : 0;
        resolve({ code, stdout, stderr });
      },
    );
  });
}

const onDemo = (...args: string[]) => ['--project', EMULATOR_PROJECT_ID, ...args];

async function post(url: string, body: unknown): Promise<unknown> {
  const response = await fetch(url, {
    method: 'POST',
    headers: ADMIN_HEADERS,
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`${url} → ${response.status} ${await response.text()}`);
  return response.json();
}

function createPasswordAccount({ uid, email }: Leftover) {
  return post(`${AUTH_API}/accounts`, {
    localId: uid,
    email,
    password: 'solo-para-esta-prueba', // public-ok: made up here for emulator accounts
  });
}

const updateAccount = (body: Record<string, unknown>) => post(`${AUTH_API}/accounts:update`, body);

function linkGoogle({ uid, email }: Leftover) {
  return updateAccount({
    localId: uid,
    linkProviderUserInfo: { providerId: 'google.com', rawId: googleIdOf(email), email },
  });
}

/** The sessions of the account count from long ago, so that a revocation now shows. */
const startSessionsLongAgo = (uid: string) =>
  updateAccount({ localId: uid, validSince: String(LONG_AGO_SECONDS) });

async function writeDocument(path: string, fields: Record<string, unknown>) {
  const response = await fetch(`${DOCUMENTS}/${path}`, {
    method: 'PATCH',
    headers: ADMIN_HEADERS,
    body: JSON.stringify({ fields }),
  });
  if (!response.ok) throw new Error(`${path} → ${response.status}`);
}

const text = (value: string) => ({ stringValue: value });

interface Account {
  validSince?: string;
  passwordHash?: string;
  providerUserInfo?: { providerId: string }[];
}

async function lookup(uid: string): Promise<Account | null> {
  const found = (await post(`${AUTH_API}/accounts:lookup`, { localId: [uid] })) as {
    users?: Account[];
  };
  return found.users?.[0] ?? null;
}

const accountExists = async (uid: string) => (await lookup(uid)) !== null;

/** Whether the refresh tokens issued before the run were revoked. */
const sessionsRevoked = async (uid: string) =>
  Number((await lookup(uid))?.validSince ?? 0) > LONG_AGO_SECONDS;

const providersOf = async (uid: string) =>
  ((await lookup(uid))?.providerUserInfo ?? []).map((info) => info.providerId);

async function survivors(uids: string[]): Promise<string[]> {
  const checks = await Promise.all(uids.map(accountExists));
  return uids.filter((_, index) => checks[index]);
}

async function revokedAmong(uids: string[]): Promise<string[]> {
  const checks = await Promise.all(uids.map(sessionsRevoked));
  return uids.filter((_, index) => checks[index]);
}

beforeEach(async () => {
  await seedEmulators();
  for (const account of LEFTOVERS) await createPasswordAccount(account);
  await linkGoogle(BOTH);
  await writeDocument(`users/${WITH_DATA.uid}`, { displayName: text('V. Vieja') });
  await writeDocument(`distributors/purge-test/members/${MEMBER.uid}`, {
    uid: text(MEMBER.uid),
    role: text('driver'),
  });
  await writeDocument(`platformAdmins/${PLATFORM_ADMIN.uid}`, { note: text('prueba') });
  for (const uid of [...seededUids, ...leftoverUids]) await startSessionsLongAgo(uid);
});

describe('scripts/purge-password-accounts.mjs — rehearsal', () => {
  it('only rehearses by default: says what it would do and changes nothing', async () => {
    const result = await run(onDemo());

    expect(result.code).toBe(0);
    expect(result.stdout).toContain('REHEARSAL (nothing was changed)');
    expect(result.stdout).toContain(`${LEFTOVER.uid}  ${LEFTOVER.email}`);
    expect(result.stdout).toContain('Run it again with --delete');
    expect(await survivors(leftoverUids)).toEqual(leftoverUids);
    expect(await providersOf(BOTH.uid)).toContain('password');
    expect(await revokedAmong([...seededUids, ...leftoverUids])).toEqual([]);
  });
});

describe('scripts/purge-password-accounts.mjs --delete', () => {
  it('deletes the account that only has a password, no data and no role', async () => {
    const result = await run(onDemo('--delete'));

    expect(result.code).toBe(0);
    expect(result.stdout).toMatch(/account deleted — password only, no profile, no role: 1\n/);
    expect(await accountExists(LEFTOVER.uid)).toBe(false);
  });

  it.each([
    ['a member of a distributor', MEMBER],
    ['a platform admin', PLATFORM_ADMIN],
  ])('keeps a password account that is %s, ends its sessions and says so', async (_c, who) => {
    const result = await run(onDemo('--delete'));

    expect(await accountExists(who.uid)).toBe(true);
    expect(await sessionsRevoked(who.uid)).toBe(true);
    expect(result.stdout).toMatch(/holds a role \(platform admin or member\): 2\n/);
    expect(result.stdout).toContain(`${who.uid}  ${who.email}`);
  });

  it('keeps a password account that holds data for delete-account.mjs, ends its sessions and says so', async () => {
    const result = await run(onDemo('--delete'));

    expect(await accountExists(WITH_DATA.uid)).toBe(true);
    expect(await sessionsRevoked(WITH_DATA.uid)).toBe(true);
    expect(result.stdout).toMatch(
      /WITH a profile \(use scripts\/delete-account\.mjs\): 1\n\s+vieja-con-perfil {2}vieja-con-perfil@example\.com/,
    );
  });

  it('unlinks the password of an account that also enters with Google and ends its sessions', async () => {
    const result = await run(onDemo('--delete'));

    expect(await providersOf(BOTH.uid)).toEqual(['google.com']);
    expect((await lookup(BOTH.uid))?.passwordHash).toBeUndefined();
    expect(await sessionsRevoked(BOTH.uid)).toBe(true);
    expect(result.stdout).toMatch(
      /Password unlinked and sessions revoked .*: 1\n\s+google-con-clave/,
    );
  });

  it('never touches an account that only enters with Google', async () => {
    const result = await run(onDemo('--delete'));

    expect(await survivors(seededUids)).toEqual(seededUids);
    expect(await revokedAmong(seededUids)).toEqual([]);
    for (const uid of seededUids) expect(result.stdout).not.toContain(uid);
  });

  it('finds nothing left to delete when it is run again', async () => {
    await run(onDemo('--delete'));

    const again = await run(onDemo('--delete'));

    expect(again.stdout).toMatch(/password only, no profile, no role: 0\n\s+\(none\)/);
    expect(again.stdout).toMatch(/also hold a password: 0\n\s+\(none\)/);
  });
});

describe('scripts/purge-password-accounts.mjs --revoke-all', () => {
  it('ends, after the cleanup, the sessions of every account that remains', async () => {
    const result = await run(onDemo('--delete', '--revoke-all'));

    const kept = [...seededUids, WITH_DATA.uid, MEMBER.uid, PLATFORM_ADMIN.uid, BOTH.uid];
    expect(await revokedAmong(kept)).toEqual(kept);
    expect(result.stdout).toContain(`every account that remains: ${kept.length}`);
  });

  it('ends every session on its own and deletes or unlinks nothing', async () => {
    await run(onDemo('--revoke-all'));

    const everyone = [...seededUids, ...leftoverUids];
    expect(await survivors(leftoverUids)).toEqual(leftoverUids);
    expect(await providersOf(BOTH.uid)).toContain('password');
    expect(await revokedAmong(everyone)).toEqual(everyone);
  });
});

describe('scripts/purge-password-accounts.mjs — refusals', () => {
  it.each([
    ['without --project', [], /Missing --project/],
    ['on a project that is not a demo, without the confirmation', ['--project', 'p'], /REAL/],
    ['with an option it does not know', onDemo('--yes'), /Unknown option "--yes"/],
  ])('refuses to run %s, before touching anything', async (_case, args, message) => {
    const withoutEmulators = args.includes('p') ? {} : EMULATOR_ENV;

    const result = await run(args, withoutEmulators);

    expect(result.code).toBe(1);
    expect(result.stderr).toMatch(message);
    expect(await accountExists(LEFTOVER.uid)).toBe(true);
  });
});
