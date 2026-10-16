// PLAN 2.10: the local scripts that delete and export one account, run as a person would run
// them, against the emulators of this lane only.
import { execFile } from 'node:child_process';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, setDoc, Timestamp } from 'firebase/firestore';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { EMULATOR_HOST, EMULATOR_PROJECT_ID, emulatorPorts } from '../../scripts/lane-ports.mjs';
import {
  SEED_CREATED_AT,
  SEED_DISTRIBUTORS,
  SEED_INVITE_CODE,
  SEED_PRIVACY_VERSION,
  SEED_TERMS_VERSION,
  SEED_USERS,
} from '../seed/data';
import { seedEmulators } from '../seed/seed';

const ports = emulatorPorts();
const EMULATOR_ENV = {
  FIRESTORE_EMULATOR_HOST: `${EMULATOR_HOST}:${ports.firestore}`,
  FIREBASE_AUTH_EMULATOR_HOST: `${EMULATOR_HOST}:${ports.auth}`,
};
const NOT_A_DEMO_PROJECT = 'some-real-project';
const AT = Timestamp.fromDate(new Date('2026-02-01T12:00:00Z'));
/** PLAN 3.2: invitations tied to the customer's address, one waiting and one used. */
const WAITING_FOR_CUSTOMER = `distributors/${SEED_DISTRIBUTORS.b.id}/invites/InviteForCustomer001`;
const USED_BY_CUSTOMER = `distributors/${SEED_DISTRIBUTORS.a.id}/invites/InviteUsedByCustomer`;
const REVIEW_OF_A = `distributors/${SEED_DISTRIBUTORS.a.id}/private/review`;
const SEEDED_INVITE_OF_A = `distributors/${SEED_DISTRIBUTORS.a.id}/invites/${SEED_INVITE_CODE}`;
/** The date of everything the seed writes, as the export prints a timestamp. */
const SEEDED_AT = new Date(SEED_CREATED_AT).toISOString();

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
    const tiedToCustomer = {
      role: 'driver',
      email: SEED_USERS.customer.email,
      distributorName: SEED_DISTRIBUTORS.b.name,
      createdAt: AT,
      updatedAt: AT,
    };
    await setDoc(doc(context.firestore(), WAITING_FOR_CUSTOMER), {
      ...tiedToCustomer,
      status: 'pending',
      createdBy: SEED_USERS.ownerB.uid,
    });
    await setDoc(doc(context.firestore(), USED_BY_CUSTOMER), {
      ...tiedToCustomer,
      distributorName: SEED_DISTRIBUTORS.a.name,
      status: 'accepted',
      createdBy: SEED_USERS.ownerA.uid,
      acceptedBy: SEED_USERS.customer.uid,
      acceptedAt: AT,
    });
    await setDoc(doc(context.firestore(), REVIEW_OF_A), { note: 'Revisa el RUC.', writtenAt: AT });
  });
});

afterAll(async () => {
  await env.cleanup();
});

describe('safety pattern of the account scripts', () => {
  it.each(['delete-account.mjs', 'export-account.mjs'])(
    '%s refuses a real project without the explicit confirmation, before touching anything',
    async (script) => {
      const args = ['--project', NOT_A_DEMO_PROJECT, '--uid', SEED_USERS.customer.uid];
      const result = await run(script, args, {});

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
    ['without a project', ['--uid', 'seed-cliente'], EMULATOR_ENV, '--project'],
    ['without a uid', ['--project', EMULATOR_PROJECT_ID], EMULATOR_ENV, '--uid'],
    ['with a demo project and no emulators', forUid('seed-cliente'), {}, 'demo-'],
    ['with an option it does not know', forUid('seed-cliente', '--all'), EMULATOR_ENV, '--all'],
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
      profile: {
        displayName: ownerA.displayName,
        phone: ownerA.phone,
        terms: { version: SEED_TERMS_VERSION },
      },
      addresses: [{ id: 'a0', label: 'Casa' }],
      // PLAN 2.11: the history of acceptances is part of what is stored about the person.
      legalAcceptances: [
        { id: `privacy-${SEED_PRIVACY_VERSION}`, document: 'privacy', acceptedAt: SEEDED_AT },
        { id: `terms-${SEED_TERMS_VERSION}`, document: 'terms', acceptedAt: SEEDED_AT },
      ],
      memberships: [{ role: 'owner', distributorId: SEED_DISTRIBUTORS.a.id }],
      isPlatformAdmin: false,
      foundedDistributors: [
        {
          distributorId: SEED_DISTRIBUTORS.a.id,
          publicProfile: { name: SEED_DISTRIBUTORS.a.name },
          control: { status: 'active', ownerUid: ownerA.uid },
          privateSettings: { ownerEmail: ownerA.email },
          // PLAN 3.2: the text of the note of the platform to the founder.
          reviewNote: { note: 'Revisa el RUC.' },
        },
      ],
    });
    expect(result.stdout).not.toMatch(/passwordHash|passwordSalt/);
  });

  // PLAN 3.2: an invitation keeps the address it is tied to, readable by whoever has the link.
  it('exports the invitations tied to the e-mail of the account', async () => {
    const result = await run('export-account.mjs', forUid(SEED_USERS.customer.uid));

    const { invitations } = JSON.parse(result.stdout) as { invitations: { path: string }[] };
    expect(invitations.map((invite) => invite.path).sort()).toEqual(
      [USED_BY_CUSTOMER, WAITING_FOR_CUSTOMER].sort(),
    );
  });

  it('exports an account that only signed in, with nothing else to show', async () => {
    const result = await run('export-account.mjs', forUid(SEED_USERS.noProfile.uid));

    expect(JSON.parse(result.stdout)).toMatchObject({
      signInAccount: { email: SEED_USERS.noProfile.email },
      profile: null,
      addresses: [],
      legalAcceptances: [],
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
    expect(result.stdout).toContain('history of acceptances, entries deleted: 2');
    expect(await stored(`users/${customer.uid}`)).toBeDefined();
    expect(await countIn(`users/${customer.uid}/acceptances`)).toBe(2);
    expect(await accountExists(customer.uid)).toBe(true);
  });

  it('deletes a customer: sign-in account, profile, addresses and history of acceptances', async () => {
    const { customer } = SEED_USERS;

    const result = await run('delete-account.mjs', forUid(customer.uid));

    expect(result.code).toBe(0);
    expect(await accountExists(customer.uid)).toBe(false);
    expect(await stored(`users/${customer.uid}`)).toBeUndefined();
    expect(await countIn(`users/${customer.uid}/addresses`)).toBe(0);
    expect(await countIn(`users/${customer.uid}/acceptances`)).toBe(0);
  });

  // PLAN 3.2: a waiting invitation without its address would open to anyone with the link.
  it('deleted the waiting invitation tied to its e-mail and emptied the used one', async () => {
    expect(await stored(WAITING_FOR_CUSTOMER)).toBeUndefined();
    expect(await stored(USED_BY_CUSTOMER)).toMatchObject({ status: 'accepted', email: null });
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
      // PLAN 2.11: the verification data may be personal (a natural person's RUC).
      taxId: '',
      legalName: '',
      hydrocarbonsRegistry: '',
    });
    expect(await stored(`distributors/${a.id}/members/${ownerA.uid}`)).toMatchObject({
      displayName: 'Cuenta eliminada',
      active: false,
    });
    expect(await stored(`distributors/${a.id}/members/${dispatcherA.uid}`)).toMatchObject({
      displayName: dispatcherA.displayName,
      active: true,
    });
    // PLAN 3.2: the note may talk about the RUC. The invitation it created stays as it was,
    // without its name; the rules no longer honour it, its author is switched off (2026-10-16).
    expect(await stored(REVIEW_OF_A)).toBeUndefined();
    expect(await stored(SEEDED_INVITE_OF_A)).toMatchObject({
      status: 'pending',
      invitedByName: 'Cuenta eliminada',
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
