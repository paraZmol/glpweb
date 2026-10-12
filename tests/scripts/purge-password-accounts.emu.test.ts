// PLAN 2.1: sign-in is with Google only. The local script that removes the accounts that could
// only enter with a password, run as a person would run it, against the emulators of this lane.
import { execFile } from 'node:child_process';
import { beforeEach, describe, expect, it } from 'vitest';
import { EMULATOR_HOST, EMULATOR_PROJECT_ID, emulatorPorts } from '../../scripts/lane-ports.mjs';
import { SEED_USERS } from '../seed/data';
import { seedEmulators } from '../seed/seed';

const ports = emulatorPorts();
const EMULATOR_ENV = {
  FIRESTORE_EMULATOR_HOST: `${EMULATOR_HOST}:${ports.firestore}`,
  FIREBASE_AUTH_EMULATOR_HOST: `${EMULATOR_HOST}:${ports.auth}`,
};
const ADMIN_HEADERS = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' };
const AUTH_API = `http://${EMULATOR_HOST}:${ports.auth}/identitytoolkit.googleapis.com/v1`;
const DOCUMENTS = `http://${EMULATOR_HOST}:${ports.firestore}/v1/projects/${EMULATOR_PROJECT_ID}/databases/(default)/documents`;
const SCRIPT = 'scripts/purge-password-accounts.mjs';

/** An account as the retired registration left it: a password and nothing else. */
const LEFTOVER = { uid: 'vieja-sin-perfil', email: 'vieja-sin-perfil@example.com' };
/** The same, but it got as far as having a profile: it holds data. */
const WITH_DATA = { uid: 'vieja-con-perfil', email: 'vieja-con-perfil@example.com' };

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

function createPasswordAccount({ uid, email }: { uid: string; email: string }) {
  return post(`${AUTH_API}/projects/${EMULATOR_PROJECT_ID}/accounts`, {
    localId: uid,
    email,
    password: 'solo-para-esta-prueba', // public-ok: made up here for emulator accounts
  });
}

async function writeProfile(uid: string) {
  const response = await fetch(`${DOCUMENTS}/users/${uid}`, {
    method: 'PATCH',
    headers: ADMIN_HEADERS,
    body: JSON.stringify({ fields: { displayName: { stringValue: 'V. Vieja' } } }),
  });
  if (!response.ok) throw new Error(`profile of ${uid} → ${response.status}`);
}

async function accountExists(uid: string): Promise<boolean> {
  const found = (await post(`${AUTH_API}/projects/${EMULATOR_PROJECT_ID}/accounts:lookup`, {
    localId: [uid],
  })) as { users?: unknown[] };
  return (found.users ?? []).length > 0;
}

const seededUids = Object.values(SEED_USERS).map((user) => user.uid);

async function survivors(uids: string[]): Promise<string[]> {
  const checks = await Promise.all(uids.map(accountExists));
  return uids.filter((_, index) => checks[index]);
}

beforeEach(async () => {
  await seedEmulators();
  await createPasswordAccount(LEFTOVER);
  await createPasswordAccount(WITH_DATA);
  await writeProfile(WITH_DATA.uid);
});

describe('scripts/purge-password-accounts.mjs', () => {
  it('only rehearses by default: says what it would delete and deletes nothing', async () => {
    const result = await run(onDemo());

    expect(result.code).toBe(0);
    expect(result.stdout).toContain('REHEARSAL (nothing was deleted)');
    expect(result.stdout).toContain(`${LEFTOVER.uid}  ${LEFTOVER.email}`);
    expect(result.stdout).toContain('Run it again with --delete');
    expect(await survivors([LEFTOVER.uid, WITH_DATA.uid])).toEqual([LEFTOVER.uid, WITH_DATA.uid]);
  });

  it('deletes, with --delete, the account that only has a password and no data', async () => {
    const result = await run(onDemo('--delete'));

    expect(result.code).toBe(0);
    expect(result.stdout).toMatch(/account deleted — password only, no profile: 1\n/);
    expect(await accountExists(LEFTOVER.uid)).toBe(false);
  });

  it('never touches an account that enters with Google', async () => {
    const result = await run(onDemo('--delete'));

    expect(await survivors(seededUids)).toEqual(seededUids);
    for (const uid of seededUids) expect(result.stdout).not.toContain(uid);
  });

  it('leaves a password account that holds data for delete-account.mjs, and says so', async () => {
    const result = await run(onDemo('--delete'));

    expect(await accountExists(WITH_DATA.uid)).toBe(true);
    expect(result.stdout).toMatch(
      /WITH a profile \(use scripts\/delete-account\.mjs\): 1\n\s+vieja-con-perfil {2}vieja-con-perfil@example\.com/,
    );
  });

  it('finds nothing left to delete when it is run again', async () => {
    await run(onDemo('--delete'));

    const again = await run(onDemo('--delete'));

    expect(again.stdout).toMatch(/password only, no profile: 0\n\s+\(none\)/);
  });

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
