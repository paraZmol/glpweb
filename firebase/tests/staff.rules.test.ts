// PLAN 3.2 — how an owner manages the staff once it is in: who may change a role or switch a
// member off. Nobody changes itself, the founder is never changed, and only the founder makes,
// unmakes or switches off another owner, so the distributor always keeps the owner that founded
// it. Staff is never deleted: it is switched off and keeps its author on what it did.
import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { deleteDoc, doc, serverTimestamp, Timestamp, updateDoc } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { createEnv, type Db, memberDoc, seedDoc, seedWorld, verified, WORLD } from './helpers';

let env: RulesTestEnvironment;
const A = WORLD.a.d;
const FOUNDER = 'owner-a';
const CO_OWNER = 'co-owner';
const OTHER_CO_OWNER = 'co-owner-2';
const PAST = Timestamp.fromDate(new Date('2026-02-01T12:00:00Z'));
const stamp = { updatedAt: serverTimestamp() };
const memberOf = (db: Db, uid: string) => doc(db, `distributors/${A}/members/${uid}`);

beforeAll(async () => {
  env = await createEnv('staff');
});

beforeEach(async () => {
  await env.clearFirestore();
  await seedWorld(env);
  for (const uid of [CO_OWNER, OTHER_CO_OWNER]) {
    await seedDoc(
      env,
      `distributors/${A}/members/${uid}`,
      memberDoc(A, uid, 'owner', { createdAt: PAST, updatedAt: PAST }),
    );
  }
});

afterAll(async () => {
  await env.cleanup();
});

describe('staff — the founder manages the owners', () => {
  it.each([
    ['makes a driver an owner', 'driver-a', { role: 'owner' }],
    ['demotes a co-owner', CO_OWNER, { role: 'dispatcher' }],
    ['switches a co-owner off', CO_OWNER, { active: false }],
  ])('lets the founder: %s', async (_case, uid, change) => {
    await assertSucceeds(updateDoc(memberOf(verified(env, FOUNDER), uid), { ...change, ...stamp }));
  });
});

describe('staff — a co-owner manages the dispatchers and the drivers only', () => {
  const coOwner = () => verified(env, CO_OWNER);

  it.each([
    ['makes a driver a dispatcher', 'driver-a', { role: 'dispatcher' }],
    ['switches a dispatcher off', 'dispatcher-a', { active: false }],
    ['switches a driver back on', 'driver-a', { active: true }],
  ])('lets a co-owner: %s', async (_case, uid, change) => {
    await assertSucceeds(updateDoc(memberOf(coOwner(), uid), { ...change, ...stamp }));
  });

  it.each([
    ['make a driver an owner', 'driver-a', { role: 'owner' }],
    [
      'make a dispatcher an owner while switching it off',
      'dispatcher-a',
      { role: 'owner', active: false },
    ],
    ['demote another co-owner', OTHER_CO_OWNER, { role: 'driver' }],
    ['switch another co-owner off', OTHER_CO_OWNER, { active: false }],
    ['rename another co-owner', OTHER_CO_OWNER, { displayName: 'Otro Nombre' }],
    ['demote the founder', FOUNDER, { role: 'driver' }],
    ['switch the founder off', FOUNDER, { active: false }],
  ])('blocks a co-owner from trying to %s', async (_case, uid, change) => {
    await assertFails(updateDoc(memberOf(coOwner(), uid), { ...change, ...stamp }));
  });
});

// "Un titular no puede quitarse a sí mismo dejando la distribuidora sin titular."
describe('staff — nobody leaves the distributor without an owner', () => {
  it.each([
    ['the founder', FOUNDER],
    ['a co-owner', CO_OWNER],
  ])('blocks %s from demoting or switching off itself', async (_who, uid) => {
    const own = memberOf(verified(env, uid), uid);
    await assertFails(updateDoc(own, { role: 'dispatcher', ...stamp }));
    await assertFails(updateDoc(own, { active: false, ...stamp }));
  });

  it.each([
    ['the founder', FOUNDER],
    ['a co-owner', CO_OWNER],
    ['a dispatcher', 'dispatcher-a'],
  ])('blocks %s from deleting a member, itself included', async (_who, uid) => {
    const db = verified(env, uid);
    await assertFails(deleteDoc(memberOf(db, uid)));
    await assertFails(deleteDoc(memberOf(db, 'driver-a')));
  });

  it('blocks the founder from switching itself off even with a co-owner around', async () => {
    await assertFails(
      updateDoc(memberOf(verified(env, FOUNDER), FOUNDER), { active: false, ...stamp }),
    );
  });
});

describe('staff — read-only distributors', () => {
  it('blocks the owner of a suspended distributor from changing its staff', async () => {
    const d = WORLD.suspended.d;
    const driver = doc(
      verified(env, 'owner-suspended'),
      `distributors/${d}/members/driver-suspended`,
    );
    await assertFails(updateDoc(driver, { active: false, ...stamp }));
  });
});
