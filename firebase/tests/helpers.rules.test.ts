// PLAN 3.2 — helpers (ayudantes): people who go with a truck and never sign in. The staff reads
// them; only an owner adds, renames or switches them off, while the distributor is writable, in
// thirty fixed slots, and never deletes one.
import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { HELPER_NAME_MAX_LENGTH, HELPERS_QUERY_LIMIT } from '../../src/domain/staff/constants';
import {
  ADMIN_UID,
  anonymous,
  createEnv,
  CUSTOMER_UID,
  type Db,
  helperDoc,
  helperPath,
  seedDoc,
  seedWorld,
  verified,
  WORLD,
} from './helpers';

let env: RulesTestEnvironment;
const A = WORLD.a.d;
const B = WORLD.b.d;
const PAST = Timestamp.fromDate(new Date('2026-02-01T12:00:00Z'));
const stamp = { updatedAt: serverTimestamp() };
const helperOf = (db: Db, d = A, slot = 'h00') => doc(db, helperPath(d, slot));
const helpersOf = (db: Db, d = A) => collection(db, `distributors/${d}/helpers`);

beforeAll(async () => {
  env = await createEnv('helpers');
});

beforeEach(async () => {
  await env.clearFirestore();
  await seedWorld(env);
  await seedDoc(env, helperPath(A, 'h00'), helperDoc({ createdAt: PAST, updatedAt: PAST }));
  await seedDoc(env, helperPath(B, 'h00'), helperDoc({ createdAt: PAST, updatedAt: PAST }));
});

afterAll(async () => {
  await env.cleanup();
});

describe('helpers — read', () => {
  it.each(['owner-a', 'dispatcher-a', 'driver-a'])('lets %s read and list them', async (uid) => {
    const db = verified(env, uid);
    await assertSucceeds(getDoc(helperOf(db)));
    await assertSucceeds(getDocs(query(helpersOf(db), limit(HELPERS_QUERY_LIMIT))));
  });

  it('blocks an unbounded or oversized list', async () => {
    const db = verified(env, 'owner-a');
    await assertFails(getDocs(helpersOf(db)));
    await assertFails(getDocs(query(helpersOf(db), limit(HELPERS_QUERY_LIMIT + 1))));
  });

  it.each([
    ['an anonymous visitor', () => anonymous(env)],
    ['a customer', () => verified(env, CUSTOMER_UID)],
    ['the owner of another distributor', () => verified(env, 'owner-b')],
    ['a driver of another distributor', () => verified(env, 'driver-b')],
    ['a platform admin', () => verified(env, ADMIN_UID)],
  ])('blocks %s from reading the helpers of A (aislamiento A/B)', async (_who, connect) => {
    const db = connect();
    await assertFails(getDoc(helperOf(db)));
    await assertFails(getDocs(query(helpersOf(db), limit(5))));
  });
});

describe('helpers — write', () => {
  const owner = () => verified(env, 'owner-a');

  it('lets the owner add one in a free slot', async () => {
    await assertSucceeds(setDoc(helperOf(owner(), A, 'h29'), helperDoc()));
  });

  it('lets the owner rename one and switch it off', async () => {
    await assertSucceeds(updateDoc(helperOf(owner()), { name: 'Q. Ayudante', ...stamp }));
    await assertSucceeds(updateDoc(helperOf(owner()), { active: false, ...stamp }));
  });

  it.each([
    ['its dispatcher', 'dispatcher-a'],
    ['its driver', 'driver-a'],
    ['a customer', CUSTOMER_UID],
    ['the owner of another distributor', 'owner-b'],
    ['a platform admin', ADMIN_UID],
  ])('blocks %s from adding or changing one', async (_who, uid) => {
    const db = verified(env, uid);
    await assertFails(setDoc(helperOf(db, A, 'h01'), helperDoc()));
    await assertFails(updateDoc(helperOf(db), { active: false, ...stamp }));
  });

  it('blocks the owner of A from touching the helpers of B (aislamiento A/B)', async () => {
    await assertFails(setDoc(helperOf(owner(), B, 'h01'), helperDoc()));
    await assertFails(updateDoc(helperOf(owner(), B), { active: false, ...stamp }));
  });

  it.each([
    ['suspended', WORLD.suspended, 'owner-suspended'],
    ['on an expired trial', WORLD.expired, 'owner-expired'],
  ] as const)('blocks the owner of a distributor that is %s', async (_case, seeded, uid) => {
    await seedDoc(
      env,
      helperPath(seeded.d, 'h01'),
      helperDoc({ createdAt: PAST, updatedAt: PAST }),
    );
    const db = verified(env, uid);
    await assertFails(setDoc(helperOf(db, seeded.d, 'h00'), helperDoc()));
    await assertFails(updateDoc(helperOf(db, seeded.d, 'h01'), { active: false, ...stamp }));
  });

  it('blocks an edit that changes its creation date', async () => {
    await assertFails(updateDoc(helperOf(owner()), { createdAt: serverTimestamp(), ...stamp }));
  });

  it.each(['h30', 'h99', 'helper', 'h0', 'H00', 'p00'])(
    'blocks a helper outside the thirty slots (%s)',
    async (slot) => {
      await assertFails(setDoc(helperOf(owner(), A, slot), helperDoc()));
    },
  );

  it.each([
    ['an empty name', { name: '' }],
    ['a blank name', { name: '   ' }],
    ['an oversized name', { name: 'n'.repeat(HELPER_NAME_MAX_LENGTH + 1) }],
    ['a name with a zero-width space', { name: 'P.​Ayudante' }],
    ['a name of punctuation only', { name: '--' }],
    ['active as text', { active: 'yes' }],
    ['a phone (data it does not keep)', { phone: '900000001' }],
    ['a made-up date', { createdAt: PAST }],
  ])('blocks a helper with %s', async (_case, change) => {
    await assertFails(setDoc(helperOf(owner(), A, 'h01'), helperDoc(change)));
  });

  it('blocks replacing one that exists: its creation date stays', async () => {
    await assertFails(setDoc(helperOf(owner()), helperDoc()));
  });

  it('blocks an edit without a fresh date', async () => {
    await assertFails(updateDoc(helperOf(owner()), { name: 'Q. Ayudante' }));
  });

  it('blocks deleting a helper, also for the owner', async () => {
    await assertFails(deleteDoc(helperOf(owner())));
  });
});
