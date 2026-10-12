// Security audit at the close of phase 2 (2026-10-12; PLAN 2.11). Three ways of getting past the
// review of a listing without really changing it, or of changing it without being reviewed:
//   M1  an approved listing moves its address or its plant and stays approved;
//   B1  "corrections sent" next to a write that corrects nothing;
//   B2  any member of the staff moves the version of the listing, so the review goes stale.
// Each attack must fail; its legitimate twin must pass.
import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  deleteField,
  doc,
  getDoc,
  serverTimestamp,
  Timestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  ADMIN_UID,
  anonymous,
  backToReview,
  controlDoc,
  createEnv,
  type Db,
  distributorDoc,
  editIdentity,
  memberDoc,
  reviewedMarks,
  seedDoc,
  seedWorld,
  verified,
  WORLD,
} from './helpers';

let env: RulesTestEnvironment;
const A = WORLD.a.d;
const PENDING = WORLD.pending.d;
const PAST = Timestamp.fromDate(new Date('2020-01-01T00:00:00Z'));
const old = { createdAt: PAST, updatedAt: PAST };
const stamp = { updatedAt: serverTimestamp() };
const NOTE = 'El RUC no coincide con la razón social.';
const ELSEWHERE = { lat: -16.409, lng: -71.5375 };

const admin = () => verified(env, ADMIN_UID);
const profileOf = (db: Db, d: string) => doc(db, `distributors/${d}`);
const controlOf = (db: Db, d: string) => doc(db, `distributors/${d}/private/control`);
const settingsOf = (db: Db, d: string) => doc(db, `distributors/${d}/private/settings`);
const stored = async (path: string) => (await getDoc(doc(admin(), path))).data() ?? {};

beforeAll(async () => {
  env = await createEnv('attack-review-integrity');
});

beforeEach(async () => {
  await env.clearFirestore();
  await seedWorld(env);
});

afterAll(async () => {
  await env.cleanup();
});

// ---------------------------------------------------------------------------------------------
// M1 — where the business is belongs to what was approved.
// ---------------------------------------------------------------------------------------------
describe('M1 — an approved listing cannot move without a new review', () => {
  const owner = () => verified(env, 'owner-a');

  it.each([
    ['its address line, to advertise another phone', { addressLine: 'Pedidos SOLO al 900000099' }],
    ['its plant, to show up in the search of another city', { plant: ELSEWHERE }],
    ['both at once', { addressLine: 'Av. Otra Ciudad 1', plant: ELSEWHERE }],
    ['its address next to an ordinary edit', { addressLine: 'Av. Otra 2', brandColor: '#0a7cff' }],
  ])('blocks an owner from changing %s while it stays listed', async (_case, change) => {
    await assertFails(updateDoc(profileOf(owner(), A), { ...change, ...stamp }));

    expect(await stored(`distributors/${A}`)).toMatchObject({
      addressLine: 'Av. Principal 100',
      acceptingOrders: true,
    });
  });

  it.each([
    ['its address line', { addressLine: 'Av. Nueva 500' }],
    ['its plant', { plant: ELSEWHERE }],
  ])('lets the owner change %s by sending the listing back to review', async (_case, change) => {
    await assertSucceeds(editIdentity(owner(), A, change));

    expect((await stored(`distributors/${A}/private/control`)).listingApproved).toBe(false);
    await assertFails(getDoc(profileOf(anonymous(env), A)));
  });

  it.each([
    ['keeps the distributor listed', { acceptingOrders: true }, backToReview()],
    ['leaves the listing approved', { acceptingOrders: false }, null],
    ['only refreshes the control document', { acceptingOrders: false }, stamp],
  ])('blocks a new plant in a batch that %s', async (_case, flag, controlChange) => {
    const db = owner();
    const batch = writeBatch(db);
    batch.update(profileOf(db, A), { plant: ELSEWHERE, ...flag, ...stamp });
    if (controlChange) batch.update(controlOf(db, A), controlChange);

    await assertFails(batch.commit());
  });

  it('lets a listing that still waits for its review move plainly: nothing was approved yet', async () => {
    const pending = profileOf(verified(env, 'owner-pending'), PENDING);

    await assertSucceeds(updateDoc(pending, { addressLine: 'Av. En Espera 3', ...stamp }));
    await assertSucceeds(updateDoc(pending, { plant: ELSEWHERE, ...stamp }));
  });

  it('blocks a listing that waits from listing itself with an edit of the address', async () => {
    const pending = profileOf(verified(env, 'owner-pending'), PENDING);

    await assertFails(
      updateDoc(pending, { addressLine: 'Av. En Espera 3', acceptingOrders: true, ...stamp }),
    );
  });

  // Routine adjustments stay routine (PLAN §9: accepted risk, the radius is capped at 50 km).
  it.each([
    ['the delivery radius', { coverageRadiusKm: 12 }],
    ['the schedule', { schedule: { days: [1, 2, 3], opensAt: '09:00', closesAt: '17:00' } }],
  ])('still lets an approved listing change %s and stay listed', async (_case, change) => {
    await assertSucceeds(updateDoc(profileOf(owner(), A), { ...change, ...stamp }));

    const seen = await getDoc(profileOf(anonymous(env), A));
    expect(seen.data()?.acceptingOrders).toBe(true);
  });
});

// ---------------------------------------------------------------------------------------------
// B1 — the correction mark travels with a correction.
// ---------------------------------------------------------------------------------------------
const mark = () => ({ correctedAt: serverTimestamp(), ...stamp });

/** A batch of one write to the listing and the correction mark in the control document. */
function markedWith(db: Db, d: string, target: 'profile' | 'settings', change: object) {
  const batch = writeBatch(db);
  const edited = target === 'profile' ? profileOf(db, d) : settingsOf(db, d);
  batch.update(edited, { ...change, ...stamp });
  batch.update(controlOf(db, d), mark());
  return batch.commit();
}

describe('B1 — "corrections sent" needs something corrected', () => {
  const owner = () => verified(env, 'owner-pending');

  beforeEach(async () => {
    await updateDoc(controlOf(admin(), PENDING), {
      reviewNote: NOTE,
      correctedAt: deleteField(),
      ...stamp,
    });
  });

  it.each([
    ['only refreshes the date of the public profile', 'profile', {}],
    ['rewrites the public flag with the value it had', 'profile', { acceptingOrders: false }],
    ['rewrites the address with the value it had', 'profile', { addressLine: 'Av. Principal 100' }],
    ['only refreshes the date of the private settings', 'settings', {}],
    ['rewrites the legal name with the value it had', 'settings', { legalName: 'Gas Demo S.A.C.' }],
  ] as const)('blocks the mark next to a write that %s', async (_case, target, change) => {
    await assertFails(markedWith(owner(), PENDING, target, change));

    expect(await stored(`distributors/${PENDING}/private/control`)).not.toHaveProperty(
      'correctedAt',
    );
  });

  it('blocks it from a driver who only refreshes the date of the public profile', async () => {
    await assertFails(markedWith(verified(env, 'driver-pending'), PENDING, 'profile', {}));
  });

  it('blocks it next to two writes that both correct nothing', async () => {
    const db = owner();
    const batch = writeBatch(db);
    batch.update(profileOf(db, PENDING), stamp);
    batch.update(settingsOf(db, PENDING), stamp);
    batch.update(controlOf(db, PENDING), mark());

    await assertFails(batch.commit());
  });

  // A state the rules never leave behind (a listing that waits is unlisted), but one a document
  // older than them could be in: putting the flag right is still not a correction.
  it('blocks it next to the repair of a public flag that was left on true', async () => {
    await seedDoc(
      env,
      `distributors/${PENDING}`,
      distributorDoc(WORLD.pending.slug, { acceptingOrders: true, ...old }),
    );

    await assertFails(markedWith(owner(), PENDING, 'profile', { acceptingOrders: false }));
    await assertSucceeds(
      updateDoc(profileOf(owner(), PENDING), { acceptingOrders: false, ...stamp }),
    );
  });

  it.each([
    ['the public profile', 'profile', { brandColor: '#0a7cff' }],
    ['the address of the public profile', 'profile', { addressLine: 'Av. Corregida 200' }],
    ['the private settings', 'settings', { legalName: 'Gas Demo Corregida S.A.C.' }],
    ['the contact name of the founder', 'settings', { ownerName: 'B. Persona' }],
  ] as const)('lets the owner mark a real correction of %s', async (_case, target, change) => {
    await assertSucceeds(markedWith(owner(), PENDING, target, change));

    expect((await stored(`distributors/${PENDING}/private/control`)).correctedAt).toBeInstanceOf(
      Timestamp,
    );
  });

  it('lets the mark travel with a real correction next to a write that corrects nothing', async () => {
    const db = owner();
    const batch = writeBatch(db);
    batch.update(profileOf(db, PENDING), stamp);
    batch.update(settingsOf(db, PENDING), { legalName: 'Gas Demo Corregida S.A.C.', ...stamp });
    batch.update(controlOf(db, PENDING), mark());

    await assertSucceeds(batch.commit());
  });
});

describe('B1 — no correction is marked on a distributor that cannot be written', () => {
  const d = WORLD.expired.d;

  // The trial ran out and its listing waits with a note. Its public flag was left on true, so
  // putting it right is a real write of the public profile that needs no writable distributor.
  beforeEach(async () => {
    await seedDoc(
      env,
      `distributors/${d}/private/control`,
      controlDoc('owner-expired', {
        trialEndsAt: PAST,
        slug: WORLD.expired.slug,
        reviewNote: NOTE,
        ...old,
      }),
    );
    await seedDoc(
      env,
      `distributors/${d}`,
      distributorDoc(WORLD.expired.slug, { acceptingOrders: true, ...old }),
    );
  });

  it('blocks the mark next to the repair of the public flag', async () => {
    const db = verified(env, 'owner-expired');

    await assertFails(markedWith(db, d, 'profile', { acceptingOrders: false }));
    await assertSucceeds(updateDoc(profileOf(db, d), { acceptingOrders: false, ...stamp }));
  });
});

// ---------------------------------------------------------------------------------------------
// B2 — the version of a listing moves only when the listing does.
// ---------------------------------------------------------------------------------------------
describe('B2 — the staff cannot make a review go stale', () => {
  const approve = (d: string, reviewed: Record<string, unknown>) => {
    const db = admin();
    const batch = writeBatch(db);
    batch.update(controlOf(db, d), {
      listingApproved: true,
      approvedAt: serverTimestamp(),
      approvedBy: ADMIN_UID,
      ...reviewed,
      ...stamp,
    });
    batch.update(profileOf(db, d), { acceptingOrders: true, ...stamp });
    return batch.commit();
  };

  it.each([
    ['its driver', 'driver-pending'],
    ['a co-owner who was deactivated', 'ex-owner'],
  ])('keeps an open review valid against %s refreshing the date', async (_who, uid) => {
    await seedDoc(
      env,
      `distributors/${PENDING}/members/ex-owner`,
      memberDoc(PENDING, 'ex-owner', 'owner', { active: false, ...old }),
    );
    const seen = await reviewedMarks(env, PENDING);
    const own = profileOf(verified(env, uid), PENDING);

    await assertFails(updateDoc(own, stamp));
    await assertFails(updateDoc(own, { acceptingOrders: false, ...stamp }));

    await assertSucceeds(approve(PENDING, seen));
  });

  it.each([
    ['its dispatcher', 'dispatcher-a'],
    ['its driver', 'driver-a'],
  ])('blocks %s from rewriting the flag of a listed distributor as it is', async (_who, uid) => {
    const own = profileOf(verified(env, uid), A);
    const before = (await stored(`distributors/${A}`)).updatedAt as Timestamp;

    await assertFails(updateDoc(own, stamp));
    await assertFails(updateDoc(own, { acceptingOrders: true, ...stamp }));

    expect(((await stored(`distributors/${A}`)).updatedAt as Timestamp).isEqual(before)).toBe(true);
  });

  it('still lets a driver put right a flag that fell behind, once', async () => {
    const d = WORLD.expired.d;
    await seedDoc(
      env,
      `distributors/${d}`,
      distributorDoc(WORLD.expired.slug, { acceptingOrders: true, ...old }),
    );
    const own = profileOf(verified(env, 'driver-expired'), d);

    await assertSucceeds(updateDoc(own, { acceptingOrders: false, ...stamp }));
    await assertFails(updateDoc(own, { acceptingOrders: false, ...stamp }));
  });

  it('still lets a platform admin write the flag as it is next to its own decision', async () => {
    const db = admin();
    const batch = writeBatch(db);
    batch.update(controlOf(db, PENDING), { reviewNote: NOTE, ...stamp });
    batch.update(profileOf(db, PENDING), { acceptingOrders: false, ...stamp });

    await assertSucceeds(batch.commit());
  });
});
