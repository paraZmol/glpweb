// PLAN 2.11: the local scripts of the platform (approve, suspend and reactivate a distributor;
// grant the platform admin role), run as a person would run them, against the emulators of this
// lane only. Also the arguments every admin script refuses before it touches anything.
import { execFile } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { EMULATOR_HOST, EMULATOR_PROJECT_ID, emulatorPorts } from '../../scripts/lane-ports.mjs';
import { SEED_DISTRIBUTORS, SEED_USERS } from '../seed/data';
import { seedEmulators } from '../seed/seed';

const ports = emulatorPorts();
const EMULATOR_ENV = {
  FIRESTORE_EMULATOR_HOST: `${EMULATOR_HOST}:${ports.firestore}`,
  FIREBASE_AUTH_EMULATOR_HOST: `${EMULATOR_HOST}:${ports.auth}`,
};
const NOT_A_DEMO_PROJECT = 'some-real-project';
const { a: A, c: SUSPENDED, d: EXPIRED, e: PENDING } = SEED_DISTRIBUTORS;
const ADMIN = SEED_USERS.admin.uid;
const STATUS = 'set-distributor-status.mjs';
const GRANT = 'grant-platform-admin.mjs';

interface Run {
  code: number;
  stdout: string;
  stderr: string;
}

/** Runs one of the scripts with `node`, the way its header says. */
function run(script: string, args: string[], env: Record<string, string> = EMULATOR_ENV) {
  const withoutEmulators = Object.fromEntries(
    Object.entries(process.env).filter(([name]) => !name.includes('EMULATOR_HOST')),
  );
  return new Promise<Run>((resolve) => {
    execFile(
      process.execPath,
      [`scripts/${script}`, ...args],
      { env: { ...withoutEmulators, ...env } },
      (error, stdout, stderr) => {
        const code = error && typeof error.code === 'number' ? error.code : error ? 1 : 0;
        resolve({ code, stdout, stderr });
      },
    );
  });
}

const onDemo = (...args: string[]) => ['--project', EMULATOR_PROJECT_ID, ...args];
const act = (distributor: string, action: string, ...rest: string[]) =>
  run(STATUS, onDemo('--distributor', distributor, '--action', action, ...rest));

let env: RulesTestEnvironment;

/** Reads one document as the platform would, with the rules out of the way. */
async function stored(path: string) {
  let data: Record<string, unknown> | undefined;
  await env.withSecurityRulesDisabled(async (context) => {
    data = (await getDoc(doc(context.firestore(), path))).data();
  });
  return data;
}

const controlOf = (id: string) => stored(`distributors/${id}/private/control`);
const profileOf = (id: string) => stored(`distributors/${id}`);

/** What a visitor without a session gets when it asks for the public profile. */
async function visitorCanRead(id: string): Promise<boolean> {
  const visitor = env.unauthenticatedContext().firestore();
  return getDoc(doc(visitor, `distributors/${id}`)).then(
    () => true,
    () => false,
  );
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: EMULATOR_PROJECT_ID,
    firestore: { host: EMULATOR_HOST, port: ports.firestore },
  });
});

beforeEach(async () => {
  await seedEmulators();
});

afterAll(async () => {
  await env.cleanup();
});

describe('set-distributor-status.mjs — approve', () => {
  it('approves a listing that waits: signed, and visible to visitors', async () => {
    expect(await visitorCanRead(PENDING.id)).toBe(false);

    const result = await act(PENDING.id, 'approve', '--by', ADMIN);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain(`approve on distributor ${PENDING.id} ("${PENDING.name}")`);
    expect(result.stdout).toContain('before: status trial, listing NOT approved, hidden');
    expect(result.stdout).toContain('now: status trial, listing approved, visible');
    const control = await controlOf(PENDING.id);
    expect(control).toMatchObject({ listingApproved: true, approvedBy: ADMIN, status: 'trial' });
    expect(control?.approvedAt).toBeDefined();
    expect(await profileOf(PENDING.id)).toMatchObject({ acceptingOrders: true });
    expect(await visitorCanRead(PENDING.id)).toBe(true);
  });

  it('removes the note that was left for the owner, and the mark of its correction', async () => {
    await env.withSecurityRulesDisabled(async (context) => {
      const { Timestamp, updateDoc } = await import('firebase/firestore');
      const control = doc(context.firestore(), `distributors/${PENDING.id}/private/control`);
      await updateDoc(control, { reviewNote: 'Falta el registro.', correctedAt: Timestamp.now() });
    });

    await act(PENDING.id, 'approve', '--by', ADMIN);

    expect(await controlOf(PENDING.id)).not.toHaveProperty('reviewNote');
    expect(await controlOf(PENDING.id)).not.toHaveProperty('correctedAt');
  });

  it.each([
    ['without saying who reviewed it', [], '--by'],
    [
      'signed by an account that is not a platform admin',
      ['--by', SEED_USERS.ownerE.uid],
      'not a platform admin',
    ],
    ['signed by something that is not a uid', ['--by', 'yo@example.com'], '--by'],
  ])('refuses an approval %s, and changes nothing', async (_case, extra, mention) => {
    const result = await act(PENDING.id, 'approve', ...extra);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain(mention);
    expect(await controlOf(PENDING.id)).toMatchObject({ listingApproved: false });
    expect(await profileOf(PENDING.id)).toMatchObject({ acceptingOrders: false });
  });

  it('approves a suspended distributor without showing it', async () => {
    await env.withSecurityRulesDisabled(async (context) => {
      const { deleteField, updateDoc } = await import('firebase/firestore');
      const control = doc(context.firestore(), `distributors/${SUSPENDED.id}/private/control`);
      await updateDoc(control, {
        listingApproved: false,
        approvedAt: deleteField(),
        approvedBy: deleteField(),
      });
    });

    const result = await act(SUSPENDED.id, 'approve', '--by', ADMIN);

    expect(result.stdout).toContain('now: status suspended, listing approved, hidden');
    expect(await visitorCanRead(SUSPENDED.id)).toBe(false);
  });
});

describe('set-distributor-status.mjs — suspend and reactivate', () => {
  it('suspends: read-only, out of the search, name and phones hidden from visitors', async () => {
    expect(await visitorCanRead(A.id)).toBe(true);

    const result = await act(A.id, 'suspend');

    expect(result.code).toBe(0);
    expect(result.stdout).toContain('now: status suspended, listing approved, hidden');
    expect(await controlOf(A.id)).toMatchObject({ status: 'suspended', listingApproved: true });
    expect(await profileOf(A.id)).toMatchObject({ acceptingOrders: false, name: A.name });
    expect(await visitorCanRead(A.id)).toBe(false);
  });

  it('reactivates one whose trial is long over as active, and shows it again', async () => {
    const result = await act(SUSPENDED.id, 'reactivate');

    expect(result.stdout).toContain('now: status active, listing approved, visible');
    expect(await controlOf(SUSPENDED.id)).toMatchObject({ status: 'active' });
    expect(await visitorCanRead(SUSPENDED.id)).toBe(true);
  });

  it('reactivates one whose trial still runs back onto its trial', async () => {
    await act(PENDING.id, 'suspend');

    const result = await act(PENDING.id, 'reactivate');

    expect(result.stdout).toContain('now: status trial, listing NOT approved, hidden');
    expect(await controlOf(PENDING.id)).toMatchObject({ status: 'trial', listingApproved: false });
  });

  it('gives a distributor whose trial ran out a paid status when reactivated', async () => {
    await act(EXPIRED.id, 'reactivate');

    expect(await controlOf(EXPIRED.id)).toMatchObject({ status: 'active' });
    expect(await profileOf(EXPIRED.id)).toMatchObject({ acceptingOrders: true });
  });

  it('changes nothing in a dry run, and says what it would do', async () => {
    const result = await act(A.id, 'suspend', '--dry-run');

    expect(result.stdout).toContain('DRY RUN');
    expect(result.stdout).toContain('would be: status suspended');
    expect(await controlOf(A.id)).toMatchObject({ status: 'active' });
    expect(await profileOf(A.id)).toMatchObject({ acceptingOrders: true });
  });
});

describe('set-distributor-status.mjs — what it refuses', () => {
  it('refuses a real project without the explicit confirmation, before touching anything', async () => {
    const args = ['--project', NOT_A_DEMO_PROJECT, '--distributor', A.id, '--action', 'suspend'];
    const result = await run(STATUS, args, {});

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('--yes-real-project');
    expect(result.stdout).toBe('');
  });

  it('refuses to run with only one of the two emulators configured', async () => {
    const half = { FIRESTORE_EMULATOR_HOST: EMULATOR_ENV.FIRESTORE_EMULATOR_HOST };
    const result = await run(STATUS, onDemo('--distributor', A.id, '--action', 'suspend'), half);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('FIREBASE_AUTH_EMULATOR_HOST');
  });

  it.each([
    ['without a project', ['--distributor', A.id, '--action', 'suspend'], '--project'],
    ['without a distributor', onDemo('--action', 'suspend'), '--distributor'],
    ['without an action', onDemo('--distributor', A.id), '--action'],
    [
      'with an action it does not know',
      onDemo('--distributor', A.id, '--action', 'delete'),
      'delete',
    ],
    [
      'with an option it does not know',
      onDemo('--distributor', A.id, '--action', 'suspend', '--all'),
      '--all',
    ],
    [
      'with a path in place of the id',
      onDemo('--distributor', 'a/private/control', '--action', 'suspend'),
      '--distributor',
    ],
    [
      'with a name in place of the id',
      onDemo('--distributor', 'Gas Demo Norte', '--action', 'suspend'),
      '--distributor',
    ],
    [
      'for a distributor that does not exist',
      onDemo('--distributor', 'no-existe-123', '--action', 'suspend'),
      'does not exist',
    ],
  ])('refuses to run %s', async (_case, args, mention) => {
    const result = await run(STATUS, args);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain(mention);
    expect(await controlOf(A.id)).toMatchObject({ status: 'active' });
  });
});

describe('grant-platform-admin.mjs', () => {
  const customer = SEED_USERS.customer.uid;
  const grantOf = (uid: string) => stored(`platformAdmins/${uid}`);

  it('grants the role to a verified account and revokes it again', async () => {
    const granted = await run(GRANT, onDemo('--uid', customer));

    expect(granted.code).toBe(0);
    expect(granted.stdout).toContain(`Granted platform admin for ${customer}`);
    expect(await grantOf(customer)).toMatchObject({ grantedBy: 'script' });

    const revoked = await run(GRANT, onDemo('--uid', customer, '--revoke'));

    expect(revoked.stdout).toContain(`Revoked platform admin for ${customer}`);
    expect(await grantOf(customer)).toBeUndefined();
  });

  it('refuses an account that never verified its e-mail', async () => {
    const result = await run(GRANT, onDemo('--uid', SEED_USERS.unverified.uid));

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('no verified e-mail');
    expect(await grantOf(SEED_USERS.unverified.uid)).toBeUndefined();
  });

  it('refuses a real project without the explicit confirmation', async () => {
    const result = await run(GRANT, ['--project', NOT_A_DEMO_PROJECT, '--uid', customer], {});

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('--yes-real-project');
  });

  // Before: with only the Firestore variable set, the role was written to the emulator while
  // the account was looked up in the real project.
  it('refuses to run with only one of the two emulators configured', async () => {
    const half = { FIRESTORE_EMULATOR_HOST: EMULATOR_ENV.FIRESTORE_EMULATOR_HOST };
    const result = await run(GRANT, onDemo('--uid', customer), half);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('FIREBASE_AUTH_EMULATOR_HOST');
  });

  it.each([
    ['an option it does not know', onDemo('--uid', customer, '--force'), '--force'],
    ['a stray argument', onDemo('--uid', customer, 'revoke'), 'revoke'],
    ['no uid', onDemo(), '--uid'],
  ])('refuses %s', async (_case, args, mention) => {
    const result = await run(GRANT, args);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain(mention);
    expect(await grantOf(customer)).toBeUndefined();
  });
});

describe('--uid — what every admin script refuses before it reads or writes', () => {
  const NOT_UIDS: [string, string][] = [
    ['an e-mail', 'cliente@example.com'],
    ['a document path', 'seed-cliente/addresses/a0'],
    ['a path that climbs', '../platformAdmins/seed-admin'],
    ['a value with spaces', 'seed cliente'],
    ['a value that is too short', 'abc'],
    ['the next option, swallowed as its value', '--revoke'],
    ['a value of 129 characters', 'a'.repeat(129)],
  ];
  const SCRIPTS = [GRANT, 'delete-account.mjs', 'export-account.mjs'];
  const CASES = SCRIPTS.flatMap((script) =>
    NOT_UIDS.map(([what, value]) => [script, what, value] as const),
  );

  it.each(CASES)('%s refuses %s', async (script, _what, value) => {
    const result = await run(script, onDemo('--uid', value));

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('--uid');
    expect(result.stdout).toBe('');
  });
});

describe('export-account.mjs --out', () => {
  const exportTo = (out: string) =>
    run('export-account.mjs', onDemo('--uid', SEED_USERS.customer.uid, '--out', out));

  it.each([
    ['the repository itself', 'export.json'],
    ['a folder of the repository', 'docs/export.json'],
    ['a folder git ignores', 'dist/export.json'],
    ['a path that leaves a folder and comes back', 'scripts/../tests/export.json'],
    ['a folder of the repository that does not exist yet', 'salidas/2026/export.json'],
  ])('refuses to write inside %s', async (_case, out) => {
    const result = await exportTo(out);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('inside this repository');
    expect(existsSync(out)).toBe(false);
  });

  it('writes outside the repository', async () => {
    const folder = mkdtempSync(join(tmpdir(), 'hornilla-export-'));
    const out = join(folder, 'export.json');
    try {
      const result = await exportTo(out);

      expect(result.code).toBe(0);
      expect(existsSync(out)).toBe(true);
    } finally {
      rmSync(folder, { recursive: true, force: true });
    }
  });
});
