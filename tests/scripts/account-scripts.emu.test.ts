// PLAN 2.10: the local scripts that delete and export one account, run as a person would run
// them, against the emulators of this lane only.
import { execFile } from 'node:child_process';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, setDoc, Timestamp } from 'firebase/firestore';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { EMULATOR_HOST, EMULATOR_PROJECT_ID, emulatorPorts } from '../../scripts/lane-ports.mjs';
import { SEED_DISTRIBUTORS, SEED_PASSWORD, SEED_USERS } from '../seed/data';
import { seedEmulators } from '../seed/seed';

const ports = emulatorPorts();
const EMULATOR_ENV = {
  FIRESTORE_EMULATOR_HOST: `${EMULATOR_HOST}:${ports.firestore}`,
  FIREBASE_AUTH_EMULATOR_HOST: `${EMULATOR_HOST}:${ports.auth}`,
};
const NOT_A_DEMO_PROJECT = 'some-real-project';
const AT = Timestamp.fromDate(new Date('2026-02-01T12:00:00Z'));

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

const forUid = (uid: string, ...flags: string[]) => [
  '--project',
  EMULATOR_PROJECT_ID,
  '--uid',
  uid,
  ...flags,
];

async function accountExists(uid: string): Promise<boolean> {
  const url = `http://${EMULATOR_HOST}:${ports.auth}/identitytoolkit.googleapis.com/v1/projects/${EMULATOR_PROJECT_ID}/accounts:lookup`;
  const response = await fetch(url, {
    method: 'POST',
    // `owner` is the emulator's admin bearer; it means nothing outside the emulator.
    headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    body: JSON.stringify({ localId: [uid] }),
  });
  const { users } = (await response.json()) as { users?: unknown[] };
  return (users ?? []).length > 0;
}

let env: RulesTestEnvironment;

/** Reads one document as the platform would, with the rules out of the way. */
async function stored(path: string) {
  let data: Record<string, unknown> | undefined;
  await env.withSecurityRulesDisabled(async (context) => {
    data = (await getDoc(doc(context.firestore(), path))).data();
  });
  return data;
}

async function countIn(path: string) {
  let size = 0;
  await env.withSecurityRulesDisabled(async (context) => {
    size = (await getDocs(collection(context.firestore(), path))).size;
  });
  return size;
}

beforeAll(async () => {
  await seedEmulators();
  env = await initializeTestEnvironment({
    projectId: EMULATOR_PROJECT_ID,
    firestore: { host: EMULATOR_HOST, port: ports.firestore },
  });
  await env.withSecurityRulesDisabled(async (context) => {
    const address = {
      label: 'Casa',
      addressLine: 'Calle Uno 123',
      reference: '',
      location: { lat: -12.05, lng: -77.04 },
      createdAt: AT,
      updatedAt: AT,
    };
    await setDoc(
      doc(context.firestore(), `users/${SEED_USERS.customer.uid}/addresses/a0`),
      address,
    );
    await setDoc(doc(context.firestore(), `users/${SEED_USERS.ownerA.uid}/addresses/a0`), address);
  });
});

afterAll(async () => {
  await env.cleanup();
});

describe('safety pattern of the account scripts', () => {
  it.each(['delete-account.mjs', 'export-account.mjs'])(
    '%s refuses a real project without the explicit confirmation, before touching anything',
    async (script) => {
      const result = await run(script, ['--project', NOT_A_DEMO_PROJECT, '--uid', 'x'], {});

      expect(result.code).toBe(1);
      expect(result.stderr).toContain('--yes-real-project');
      expect(result.stdout).toBe('');
    },
  );

  it.each(['delete-account.mjs', 'export-account.mjs'])(
    '%s refuses to run with only one of the two emulators configured',
    async (script) => {
      const half = { FIRESTORE_EMULATOR_HOST: EMULATOR_ENV.FIRESTORE_EMULATOR_HOST };
      const result = await run(script, forUid(SEED_USERS.customer.uid), half);

      expect(result.code).toBe(1);
      expect(result.stderr).toContain('FIREBASE_AUTH_EMULATOR_HOST');
    },
  );

  it.each([
    ['without a project', ['--uid', 'x'], EMULATOR_ENV, '--project'],
    ['without a uid', ['--project', EMULATOR_PROJECT_ID], EMULATOR_ENV, '--uid'],
    ['with a demo project and no emulators', forUid('x'), {}, 'demo-'],
    ['with an option it does not know', forUid('x', '--all'), EMULATOR_ENV, '--all'],
  ])('delete-account.mjs refuses to run %s', async (_case, args, variables, mention) => {
    const result = await run('delete-account.mjs', args, variables);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain(mention);
  });
});

describe('export-account.mjs', () => {
  it('exports everything stored about a founder as JSON', async () => {
    const { ownerA } = SEED_USERS;

    const result = await run('export-account.mjs', forUid(ownerA.uid));

    expect(result.code).toBe(0);
    const exported = JSON.parse(result.stdout) as Record<string, unknown>;
    expect(exported).toMatchObject({
      uid: ownerA.uid,
      signInAccount: { email: ownerA.email, emailVerified: true },
      profile: { displayName: ownerA.displayName, phone: ownerA.phone, terms: { version: '0.1' } },
      addresses: [{ id: 'a0', label: 'Casa' }],
      memberships: [{ role: 'owner', distributorId: SEED_DISTRIBUTORS.a.id }],
      isPlatformAdmin: false,
      foundedDistributors: [
        {
          distributorId: SEED_DISTRIBUTORS.a.id,
          publicProfile: { name: SEED_DISTRIBUTORS.a.name },
          control: { status: 'active', ownerUid: ownerA.uid },
          privateSettings: { ownerEmail: ownerA.email },
        },
      ],
    });
    expect(result.stdout).not.toContain(SEED_PASSWORD);
    expect(result.stdout).not.toMatch(/passwordHash|passwordSalt/);
  });

  it('exports an account that only signed in, with nothing else to show', async () => {
    const result = await run('export-account.mjs', forUid(SEED_USERS.noProfile.uid));

    expect(JSON.parse(result.stdout)).toMatchObject({
      signInAccount: { email: SEED_USERS.noProfile.email },
      profile: null,
      addresses: [],
      memberships: [],
      foundedDistributors: [],
    });
  });
});

describe('delete-account.mjs', () => {
  it('changes nothing in a dry run, and says what it would do', async () => {
    const { customer } = SEED_USERS;

    const result = await run('delete-account.mjs', forUid(customer.uid, '--dry-run'));

    expect(result.code).toBe(0);
    expect(result.stdout).toContain('DRY RUN');
    expect(result.stdout).toContain('addresses deleted: 1');
    expect(await stored(`users/${customer.uid}`)).toBeDefined();
    expect(await accountExists(customer.uid)).toBe(true);
  });

  it('deletes a customer: sign-in account, profile and addresses', async () => {
    const { customer } = SEED_USERS;

    const result = await run('delete-account.mjs', forUid(customer.uid));

    expect(result.code).toBe(0);
    expect(await accountExists(customer.uid)).toBe(false);
    expect(await stored(`users/${customer.uid}`)).toBeUndefined();
    expect(await countIn(`users/${customer.uid}/addresses`)).toBe(0);
  });

  it('anonymises the membership of a member of the staff and leaves the distributor working', async () => {
    const { driverB } = SEED_USERS;
    const { b } = SEED_DISTRIBUTORS;

    await run('delete-account.mjs', forUid(driverB.uid));

    expect(await stored(`distributors/${b.id}/members/${driverB.uid}`)).toMatchObject({
      uid: driverB.uid,
      displayName: 'Cuenta eliminada',
      active: false,
      role: 'driver',
    });
    expect(await stored(`distributors/${b.id}/private/control`)).toMatchObject({
      status: 'active',
    });
    expect(await stored(`distributors/${b.id}`)).toMatchObject({ acceptingOrders: true });
    expect(await accountExists(driverB.uid)).toBe(false);
  });

  it('suspends what a founder founded and empties its personal data there', async () => {
    const { ownerA, dispatcherA } = SEED_USERS;
    const { a } = SEED_DISTRIBUTORS;

    const result = await run('delete-account.mjs', forUid(ownerA.uid));

    expect(result.stdout).toContain(`${a.id} (2 other active member(s)`);
    expect(await stored(`distributors/${a.id}/private/control`)).toMatchObject({
      status: 'suspended',
      ownerUid: ownerA.uid,
    });
    expect(await stored(`distributors/${a.id}`)).toMatchObject({
      acceptingOrders: false,
      name: a.name,
    });
    expect(await stored(`distributors/${a.id}/private/settings`)).toMatchObject({
      ownerName: 'Cuenta eliminada',
      ownerPhone: '',
      ownerEmail: '',
    });
    expect(await stored(`distributors/${a.id}/members/${ownerA.uid}`)).toMatchObject({
      displayName: 'Cuenta eliminada',
      active: false,
    });
    expect(await stored(`distributors/${a.id}/members/${dispatcherA.uid}`)).toMatchObject({
      displayName: dispatcherA.displayName,
      active: true,
    });
    expect(await stored(`users/${ownerA.uid}`)).toBeUndefined();
    expect(await countIn(`users/${ownerA.uid}/addresses`)).toBe(0);
    expect(await accountExists(ownerA.uid)).toBe(false);
  });

  it('revokes the platform admin grant of an admin', async () => {
    await run('delete-account.mjs', forUid(SEED_USERS.admin.uid));

    expect(await stored(`platformAdmins/${SEED_USERS.admin.uid}`)).toBeUndefined();
  });

  it('can be run again: it finds nothing left and does not fail', async () => {
    const result = await run('delete-account.mjs', forUid(SEED_USERS.customer.uid));

    expect(result.code).toBe(0);
    expect(result.stdout).toContain('profile was deleted: there was none');
    expect(result.stdout).toContain('sign-in account: already gone');
  });

  it('leaves every other account alone', async () => {
    const { ownerB } = SEED_USERS;

    expect(await accountExists(ownerB.uid)).toBe(true);
    expect(await stored(`users/${ownerB.uid}`)).toMatchObject({ displayName: ownerB.displayName });
    expect(await stored(`distributors/${SEED_DISTRIBUTORS.b.id}/private/settings`)).toMatchObject({
      ownerEmail: ownerB.email,
    });
  });
});
