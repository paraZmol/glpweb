// PLAN 3.3 — vehicles: the staff reads them; the owner and the dispatcher add and edit them
// (PLAN §11, 2026-10-16, proposal), while the distributor is writable, in thirty fixed slots,
// and nobody deletes one.
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
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  MAX_VEHICLE_CAPACITY,
  PLATE_MAX_LENGTH,
  VEHICLE_NAME_MAX_LENGTH,
  VEHICLES_QUERY_LIMIT,
} from '../../src/domain/vehicles/constants';
import { VEHICLE_EDITOR_ROLES } from '../../src/domain/vehicles/permissions';
import {
  ADMIN_UID,
  anonymous,
  createEnv,
  CUSTOMER_UID,
  type Db,
  seedDoc,
  seedWorld,
  vehicleDoc,
  vehiclePath,
  verified,
  WORLD,
} from './helpers';

let env: RulesTestEnvironment;
const A = WORLD.a.d;
const B = WORLD.b.d;
const PAST = Timestamp.fromDate(new Date('2026-02-01T12:00:00Z'));
const stamp = { updatedAt: serverTimestamp() };
const vehicleOf = (db: Db, d = A, slot = 'v00') => doc(db, vehiclePath(d, slot));
const vehiclesOf = (db: Db, d = A) => collection(db, `distributors/${d}/vehicles`);

beforeAll(async () => {
  env = await createEnv('vehicles');
});

beforeEach(async () => {
  await env.clearFirestore();
  await seedWorld(env);
  await seedDoc(env, vehiclePath(A, 'v00'), vehicleDoc({ createdAt: PAST, updatedAt: PAST }));
  await seedDoc(env, vehiclePath(B, 'v00'), vehicleDoc({ createdAt: PAST, updatedAt: PAST }));
});

afterAll(async () => {
  await env.cleanup();
});

describe('vehicles — read', () => {
  it.each(['owner-a', 'dispatcher-a', 'driver-a'])('lets %s read and list them', async (uid) => {
    const db = verified(env, uid);
    await assertSucceeds(getDoc(vehicleOf(db)));
    await assertSucceeds(getDocs(query(vehiclesOf(db), limit(VEHICLES_QUERY_LIMIT))));
  });

  it('blocks an unbounded or oversized list', async () => {
    const db = verified(env, 'owner-a');
    await assertFails(getDocs(vehiclesOf(db)));
    await assertFails(getDocs(query(vehiclesOf(db), limit(VEHICLES_QUERY_LIMIT + 1))));
  });

  it('lets the driver of a read-only distributor still read its vehicles', async () => {
    const seeded = WORLD.suspended;
    await seedDoc(env, vehiclePath(seeded.d, 'v00'), vehicleDoc({ createdAt: PAST }));
    await assertSucceeds(getDoc(vehicleOf(verified(env, 'driver-suspended'), seeded.d)));
  });

  it.each([
    ['an anonymous visitor', () => anonymous(env)],
    ['a customer', () => verified(env, CUSTOMER_UID)],
    ['the owner of another distributor', () => verified(env, 'owner-b')],
    ['a driver of another distributor', () => verified(env, 'driver-b')],
    ['a platform admin', () => verified(env, ADMIN_UID)],
  ])('blocks %s from reading the vehicles of A (aislamiento A/B)', async (_who, connect) => {
    const db = connect();
    await assertFails(getDoc(vehicleOf(db)));
    await assertFails(getDocs(query(vehiclesOf(db), limit(5))));
  });
});

describe('vehicles — write', () => {
  const owner = () => verified(env, 'owner-a');

  it.each([
    ['the owner', 'owner-a'],
    ['the dispatcher (PLAN §11, 2026-10-16)', 'dispatcher-a'],
  ])('lets %s add one, change its capacity and switch it off', async (_who, uid) => {
    const db = verified(env, uid);
    await assertSucceeds(setDoc(vehicleOf(db, A, 'v29'), vehicleDoc({ kind: 'truck' })));
    await assertSucceeds(updateDoc(vehicleOf(db), { capacityCylinders: 4, ...stamp }));
    await assertSucceeds(updateDoc(vehicleOf(db), { active: false, ...stamp }));
  });

  it('agrees with the roles of the domain (the two tested above)', () => {
    expect(VEHICLE_EDITOR_ROLES).toEqual(['owner', 'dispatcher']);
  });

  it('lets the owner change its kind, name and plate, and take the plate away', async () => {
    await assertSucceeds(
      updateDoc(vehicleOf(owner()), {
        kind: 'tricycle',
        name: 'Trimoto',
        plate: '1234-AB',
        ...stamp,
      }),
    );
    await assertSucceeds(updateDoc(vehicleOf(owner()), { plate: null, ...stamp }));
  });

  it.each([
    ['its driver', 'driver-a'],
    ['a customer', CUSTOMER_UID],
    ['the owner of another distributor', 'owner-b'],
    ['the dispatcher of another distributor', 'dispatcher-b'],
    ['a platform admin', ADMIN_UID],
  ])('blocks %s from adding or changing one', async (_who, uid) => {
    const db = verified(env, uid);
    await assertFails(setDoc(vehicleOf(db, A, 'v01'), vehicleDoc()));
    await assertFails(updateDoc(vehicleOf(db), { capacityCylinders: 99, ...stamp }));
  });

  it('blocks the owner of A from touching the vehicles of B (aislamiento A/B)', async () => {
    await assertFails(setDoc(vehicleOf(owner(), B, 'v01'), vehicleDoc()));
    await assertFails(updateDoc(vehicleOf(owner(), B), { active: false, ...stamp }));
  });

  it.each([
    ['suspended', WORLD.suspended, 'owner-suspended'],
    ['on an expired trial', WORLD.expired, 'owner-expired'],
    ['with a payment due', WORLD.pastDue, 'owner-past-due'],
  ] as const)('blocks the owner of a distributor that is %s', async (_case, seeded, uid) => {
    await seedDoc(
      env,
      vehiclePath(seeded.d, 'v01'),
      vehicleDoc({ createdAt: PAST, updatedAt: PAST }),
    );
    const db = verified(env, uid);
    await assertFails(setDoc(vehicleOf(db, seeded.d, 'v00'), vehicleDoc()));
    await assertFails(updateDoc(vehicleOf(db, seeded.d, 'v01'), { active: false, ...stamp }));
  });

  it('blocks an edit that changes its creation date', async () => {
    await assertFails(updateDoc(vehicleOf(owner()), { createdAt: serverTimestamp(), ...stamp }));
  });

  it.each(['v30', 'v99', 'vehicle', 'v0', 'V00', 'h00', 'p00'])(
    'blocks a vehicle outside the thirty slots (%s)',
    async (slot) => {
      await assertFails(setDoc(vehicleOf(owner(), A, slot), vehicleDoc()));
    },
  );

  it.each([
    ['an unknown kind', { kind: 'bus' }],
    ['an empty name', { name: '' }],
    ['a blank name', { name: '   ' }],
    ['an oversized name', { name: 'n'.repeat(VEHICLE_NAME_MAX_LENGTH + 1) }],
    ['a name with a zero-width space', { name: 'Moto​roja' }],
    ['a name of punctuation only', { name: '--' }],
    ['a plate in lowercase', { plate: 'abc-123' }],
    ['a plate too short', { plate: 'AB' }],
    ['a plate too long', { plate: 'A'.repeat(PLATE_MAX_LENGTH + 1) }],
    ['a plate with two hyphens', { plate: 'A-B-C' }],
    ['a plate with a space', { plate: 'ABC 123' }],
    ['a plate that ends with a hyphen', { plate: 'ABC123-' }],
    ['an empty plate (none is null)', { plate: '' }],
    ['no capacity', { capacityCylinders: 0 }],
    ['a negative capacity', { capacityCylinders: -1 }],
    ['a capacity above the cap', { capacityCylinders: MAX_VEHICLE_CAPACITY + 1 }],
    ['half a cylinder', { capacityCylinders: 2.5 }],
    ['a capacity as text', { capacityCylinders: '3' }],
    ['active as text', { active: 'yes' }],
    ['a driver of its own (data it does not keep)', { driverUid: 'driver-a' }],
    ['a made-up date', { createdAt: PAST }],
  ])('blocks a vehicle with %s', async (_case, change) => {
    await assertFails(setDoc(vehicleOf(owner(), A, 'v01'), vehicleDoc(change)));
  });

  it('accepts the largest capacity and a vehicle without a plate', async () => {
    await assertSucceeds(
      setDoc(
        vehicleOf(owner(), A, 'v01'),
        vehicleDoc({ kind: 'truck', plate: null, capacityCylinders: MAX_VEHICLE_CAPACITY }),
      ),
    );
  });

  it('blocks an edit that leaves the vehicle invalid', async () => {
    await assertFails(updateDoc(vehicleOf(owner()), { capacityCylinders: 0, ...stamp }));
  });

  it('blocks replacing one that exists: its creation date stays', async () => {
    await assertFails(setDoc(vehicleOf(owner()), vehicleDoc()));
  });

  it('blocks an edit without a fresh date', async () => {
    await assertFails(updateDoc(vehicleOf(owner()), { capacityCylinders: 4 }));
  });

  it('blocks deleting a vehicle, also for the owner', async () => {
    await assertFails(deleteDoc(vehicleOf(owner())));
  });
});
