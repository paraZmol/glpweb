// PLAN §11 (2026-10-16): the e-mail of an invitation is kept 30 days after it can no longer be
// used, and removed at once at the request of the person, with or without an account. The
// script runs as a person would run it, against the emulators of this lane only.
import { execFile } from 'node:child_process';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { EMULATOR_HOST, EMULATOR_PROJECT_ID, emulatorPorts } from '../../scripts/lane-ports.mjs';
import { closedAtOf, isPastRetention } from '../../scripts/purge-invites.mjs';
import { SEED_DISTRIBUTORS, SEED_USERS } from '../seed/data';

const ports = emulatorPorts();
const EMULATOR_ENV = {
  FIRESTORE_EMULATOR_HOST: `${EMULATOR_HOST}:${ports.firestore}`,
  FIREBASE_AUTH_EMULATOR_HOST: `${EMULATOR_HOST}:${ports.auth}`,
};
const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = Date.now();
const daysAgo = (days: number) => Timestamp.fromMillis(NOW - days * DAY_MS);
const PERSON = 'persona.invitada@example.com';
const BASE = `distributors/${SEED_DISTRIBUTORS.a.id}/invites`;

/** One invitation per case, all tied to PERSON unless said otherwise. */
const CASES: Record<string, Record<string, unknown>> = {
  InvitePurgeExpiredOld: { status: 'pending', createdAt: daysAgo(40) },
  InvitePurgeExpiredNew: { status: 'pending', createdAt: daysAgo(20) },
  InvitePurgeWaiting00: { status: 'pending', createdAt: daysAgo(1) },
  InvitePurgeRevokedOld: { status: 'revoked', createdAt: daysAgo(50), revokedAt: daysAgo(31) },
  InvitePurgeRevokedNew: { status: 'revoked', createdAt: daysAgo(50), revokedAt: daysAgo(29) },
  InvitePurgeUsedOld000: { status: 'accepted', createdAt: daysAgo(50), acceptedAt: daysAgo(45) },
  InvitePurgeOtherMail0: {
    status: 'pending',
    createdAt: daysAgo(40),
    email: 'otra.persona@example.com',
  },
};

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
      ['scripts/purge-invites.mjs', ...args],
      { env: { ...withoutEmulators, ...env } },
      (error, stdout, stderr) => {
        const code = error && typeof error.code === 'number' ? error.code : error ? 1 : 0;
        resolve({ code, stdout, stderr });
      },
    );
  });
}

let env: RulesTestEnvironment;

async function stored(code: string) {
  let data: Record<string, unknown> | undefined;
  await env.withSecurityRulesDisabled(async (context) => {
    data = (await getDoc(doc(context.firestore(), `${BASE}/${code}`))).data();
  });
  return data;
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: EMULATOR_PROJECT_ID,
    firestore: { host: EMULATOR_HOST, port: ports.firestore },
  });
});

beforeEach(async () => {
  await env.withSecurityRulesDisabled(async (context) => {
    for (const [code, change] of Object.entries(CASES)) {
      await setDoc(doc(context.firestore(), `${BASE}/${code}`), {
        role: 'driver',
        email: PERSON,
        distributorName: SEED_DISTRIBUTORS.a.name,
        createdBy: SEED_USERS.ownerA.uid,
        updatedAt: Timestamp.fromMillis(NOW),
        ...change,
      });
    }
  });
});

afterAll(async () => {
  await env.withSecurityRulesDisabled(async (context) => {
    for (const code of Object.keys(CASES)) {
      await deleteDoc(doc(context.firestore(), `${BASE}/${code}`));
    }
  });
  await env.cleanup();
});

describe('purge-invites.mjs — retention', () => {
  it('clears the e-mail of what stopped working more than 30 days ago, and nothing else', async () => {
    const result = await run(['--project', EMULATOR_PROJECT_ID]);

    expect(result.code).toBe(0);
    for (const code of [
      'InvitePurgeExpiredOld',
      'InvitePurgeRevokedOld',
      'InvitePurgeUsedOld000',
    ]) {
      expect(await stored(code)).toMatchObject({ email: null });
    }
    expect(await stored('InvitePurgeOtherMail0')).toMatchObject({ email: null });
    for (const code of ['InvitePurgeExpiredNew', 'InvitePurgeWaiting00', 'InvitePurgeRevokedNew']) {
      expect(await stored(code)).toMatchObject({ email: PERSON });
    }
  });

  it('writes nothing on a dry run', async () => {
    const result = await run(['--project', EMULATOR_PROJECT_ID, '--dry-run']);

    expect(result.stdout).toContain('DRY RUN');
    expect(await stored('InvitePurgeExpiredOld')).toMatchObject({ email: PERSON });
  });
});

describe('purge-invites.mjs — at the request of a person, with or without an account', () => {
  it('deletes the waiting ones tied to the address and clears it from the rest', async () => {
    const result = await run([
      '--project',
      EMULATOR_PROJECT_ID,
      '--email',
      ' Persona.Invitada@Example.com ',
    ]);

    expect(result.code).toBe(0);
    expect(await stored('InvitePurgeWaiting00')).toBeUndefined();
    for (const code of [
      'InvitePurgeExpiredNew',
      'InvitePurgeRevokedNew',
      'InvitePurgeUsedOld000',
    ]) {
      expect(await stored(code)).toMatchObject({ email: null });
    }
    expect(await stored('InvitePurgeOtherMail0')).toMatchObject({
      email: 'otra.persona@example.com',
    });
  });

  it('refuses something that is not an address', async () => {
    const result = await run(['--project', EMULATOR_PROJECT_ID, '--email', 'nadie']);
    expect(result.code).not.toBe(0);
  });
});

describe('purge-invites.mjs — safety', () => {
  it('refuses a real project without --yes-real-project, before touching anything', async () => {
    const result = await run(['--project', 'some-real-project'], {});

    expect(result.code).not.toBe(0);
    expect(await stored('InvitePurgeExpiredOld')).toMatchObject({ email: PERSON });
  });
});

describe('when an invitation stopped working', () => {
  const at = (days: number) => ({ toMillis: () => NOW - days * DAY_MS });

  it.each([
    ['a waiting one within its days', { status: 'pending', createdAt: at(3) }, null],
    [
      'an expired one, at its seventh day',
      { status: 'pending', createdAt: at(10) },
      NOW - 3 * DAY_MS,
    ],
    ['a used one, when used', { status: 'accepted', acceptedAt: at(2) }, NOW - 2 * DAY_MS],
    ['a revoked one, when revoked', { status: 'revoked', revokedAt: at(4) }, NOW - 4 * DAY_MS],
    ['one without its dates', { status: 'revoked' }, null],
  ])('reads %s', (_case, invite, expected) => {
    expect(closedAtOf(invite, NOW)).toBe(expected);
  });

  it('keeps the e-mail for exactly 30 days after that', () => {
    expect(isPastRetention({ status: 'revoked', revokedAt: at(30) }, NOW)).toBe(true);
    expect(isPastRetention({ status: 'revoked', revokedAt: at(29) }, NOW)).toBe(false);
  });
});
