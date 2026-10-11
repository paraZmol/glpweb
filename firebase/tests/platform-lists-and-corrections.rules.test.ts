// PLAN 2.11 — what the platform panel needs from the control document, and what the owner may
// add to it: the copies of the public name and link (so a list reads one document per
// distributor), the lists of approved and suspended distributors, and the mark an owner leaves
// when it answers a note of the platform. None of them lets an owner approve itself.
import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  collectionGroup,
  deleteField,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  type QueryConstraint,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PENDING_LISTINGS_LIMIT } from '../../src/domain/tenancy/constants';
import {
  ADMIN_UID,
  anonymous,
  backToReview,
  controlDoc,
  createEnv,
  CUSTOMER_UID,
  daysFromNow,
  type Db,
  DISTRIBUTOR_NAME,
  editIdentity,
  foundDistributor,
  type FoundingOptions,
  memberDoc,
  newDistributorId,
  seedDoc,
  seedProfile,
  seedWorld,
  verified,
  without,
  WORLD,
} from './helpers';

let env: RulesTestEnvironment;
const PENDING = WORLD.pending.d;
const A = WORLD.a.d;
const PAST = Timestamp.fromDate(new Date('2020-01-01T00:00:00Z'));
const old = { createdAt: PAST, updatedAt: PAST };
const stamp = { updatedAt: serverTimestamp() };
const NOTE = 'El RUC no coincide con la razón social.';
const NEW_NAME = 'Gas Demo Renombrada';

const admin = () => verified(env, ADMIN_UID);
const controlOf = (db: Db, d: string) => doc(db, `distributors/${d}/private/control`);
const settingsOf = (db: Db, d: string) => doc(db, `distributors/${d}/private/settings`);
const profileOf = (db: Db, d: string) => doc(db, `distributors/${d}`);
const storedControl = async (d: string) => (await getDoc(controlOf(admin(), d))).data() ?? {};

/** A control document as it was before the copies of the name and the link existed. */
function legacyControl(ownerUid: string, change: Record<string, unknown> = {}) {
  return without(controlDoc(ownerUid, { ...old, ...change }), 'distributorName');
}

beforeAll(async () => {
  env = await createEnv('platform-lists');
});

beforeEach(async () => {
  await env.clearFirestore();
  await seedWorld(env);
});

afterAll(async () => {
  await env.cleanup();
});

// ---------------------------------------------------------------------------------------------
// The copies of the public name and link.
// ---------------------------------------------------------------------------------------------
describe('name and link in the control document — at founding', () => {
  const FOUNDER = 'founder-copies';
  const NEW = {
    d: newDistributorId('Copies'),
    uid: FOUNDER,
    slug: 'gas-copias',
  } satisfies FoundingOptions;

  beforeEach(async () => {
    await seedProfile(env, FOUNDER);
  });

  it('accepts a founding whose control document copies the public name and link', async () => {
    await assertSucceeds(foundDistributor(verified(env, FOUNDER), NEW));

    expect(await storedControl(NEW.d)).toMatchObject({
      distributorName: DISTRIBUTOR_NAME,
      slug: NEW.slug,
    });
  });

  it.each([
    ['another name', { distributorName: 'Gas Famosa' }],
    ['the name padded with a space', { distributorName: `${DISTRIBUTOR_NAME} ` }],
    ['the name as a number', { distributorName: 7 }],
    ['another link', { slug: 'gas-famosa' }],
    ['the link of an existing distributor', { slug: WORLD.a.slug }],
    ['the link as a number', { slug: 7 }],
  ])('blocks a founding whose control document carries %s', async (_case, change) => {
    const control = controlDoc(FOUNDER, { slug: NEW.slug, ...change });

    await assertFails(foundDistributor(verified(env, FOUNDER), { ...NEW, control }));
  });

  it('blocks a founding whose control document has no copy of the name', async () => {
    const control = without(controlDoc(FOUNDER), 'distributorName');

    await assertFails(foundDistributor(verified(env, FOUNDER), { ...NEW, control }));
  });

  it('blocks a founding whose control document has no copy of the link', async () => {
    await assertFails(foundDistributor(verified(env, FOUNDER), { ...NEW, copiesSlug: false }));
  });
});

describe('name in the control document — when the owner renames', () => {
  it('follows a rename, in the same batch, also on a listing that still waits', async () => {
    await assertSucceeds(editIdentity(verified(env, 'owner-a'), A, { name: NEW_NAME }));
    await assertSucceeds(editIdentity(verified(env, 'owner-pending'), PENDING, { name: NEW_NAME }));

    expect((await storedControl(A)).distributorName).toBe(NEW_NAME);
    expect((await storedControl(PENDING)).distributorName).toBe(NEW_NAME);
  });

  it.each([
    ['the old name', { distributorName: DISTRIBUTOR_NAME }],
    ['a third name', { distributorName: 'Gas Famosa' }],
  ])('blocks a rename that leaves %s in the control document', async (_case, control) => {
    await assertFails(editIdentity(verified(env, 'owner-a'), A, { name: NEW_NAME }, control));
  });

  it('blocks a rename that does not write the control document at all', async () => {
    // The listing already waits and is unlisted: before the copy existed this needed no batch.
    const db = verified(env, 'owner-pending');

    await assertFails(updateDoc(profileOf(db, PENDING), { name: NEW_NAME, ...stamp }));
  });

  it('asks nothing of the copy when the edit changes a phone and not the name', async () => {
    const db = verified(env, 'owner-pending');

    await assertSucceeds(
      updateDoc(profileOf(db, PENDING), { contactPhone: '900000077', ...stamp }),
    );
  });

  it.each([
    ['its owner', 'owner-pending'],
    ['the platform admin', ADMIN_UID],
  ])('blocks %s from changing or removing a copy without a rename', async (_who, uid) => {
    const control = controlOf(verified(env, uid), PENDING);

    await assertFails(updateDoc(control, { distributorName: 'Gas Famosa', ...stamp }));
    await assertFails(updateDoc(control, { slug: WORLD.a.slug, ...stamp }));
    await assertFails(updateDoc(control, { distributorName: deleteField(), ...stamp }));
    await assertFails(updateDoc(control, { slug: deleteField(), ...stamp }));
  });

  it.each([
    ['its driver', 'driver-pending'],
    ['the owner of another distributor', 'owner-a'],
    ['a customer', CUSTOMER_UID],
  ])('blocks %s from writing the copies, even with their true values', async (_who, uid) => {
    const control = controlOf(verified(env, uid), PENDING);
    const truth = { distributorName: DISTRIBUTOR_NAME, slug: WORLD.pending.slug };

    await assertFails(updateDoc(control, { ...truth, ...stamp }));
  });

  it('blocks the owner of another distributor from renaming this one through its batch', async () => {
    await assertFails(editIdentity(verified(env, 'owner-a'), PENDING, { name: NEW_NAME }));
    expect((await storedControl(PENDING)).distributorName).toBe(DISTRIBUTOR_NAME);
  });

  it('blocks the owner of a suspended distributor from renaming it', async () => {
    const db = verified(env, 'owner-suspended');

    await assertFails(editIdentity(db, WORLD.suspended.d, { name: NEW_NAME }));
  });
});

// CLAUDE.md rule 10: documents written before the copies existed keep working.
describe('a control document older than the copies', () => {
  beforeEach(async () => {
    await seedDoc(
      env,
      `distributors/${PENDING}/private/control`,
      legacyControl('owner-pending', { trialEndsAt: daysFromNow(20) }),
    );
  });

  it('is still read by its staff and listed for the admin', async () => {
    await assertSucceeds(getDoc(controlOf(verified(env, 'driver-pending'), PENDING)));
    const waiting = query(
      collectionGroup(admin(), 'private'),
      where('listingApproved', '==', false),
      limit(PENDING_LISTINGS_LIMIT),
    );

    const found = await assertSucceeds(getDocs(waiting));
    expect(found.docs.map((snapshot) => snapshot.ref.path)).toContain(
      `distributors/${PENDING}/private/control`,
    );
  });

  it('accepts a decision of the admin that does not add them', async () => {
    await assertSucceeds(updateDoc(controlOf(admin(), PENDING), { reviewNote: NOTE, ...stamp }));
  });

  it('accepts their true values from the admin, and only those', async () => {
    const control = controlOf(admin(), PENDING);
    const truth = { distributorName: DISTRIBUTOR_NAME, slug: WORLD.pending.slug };

    await assertFails(updateDoc(control, { ...truth, distributorName: 'Gas Famosa', ...stamp }));
    await assertFails(updateDoc(control, { ...truth, slug: WORLD.a.slug, ...stamp }));
    await assertSucceeds(updateDoc(control, { ...truth, ...stamp }));
  });

  it('gains the copy of the name when its owner renames it, and not without it', async () => {
    const db = verified(env, 'owner-pending');

    await assertFails(
      editIdentity(db, PENDING, { name: NEW_NAME }, { distributorName: deleteField() }),
    );
    await assertSucceeds(editIdentity(db, PENDING, { name: NEW_NAME }));
    expect((await storedControl(PENDING)).distributorName).toBe(NEW_NAME);
  });

  it('still lets its owner send it back to review without the copies', async () => {
    const db = verified(env, 'owner-pending');

    await assertSucceeds(updateDoc(controlOf(db, PENDING), backToReview()));
  });
});

// ---------------------------------------------------------------------------------------------
// The lists of the platform panel.
// ---------------------------------------------------------------------------------------------
describe('lists of distributors — approved and suspended', () => {
  const controls = (db: Db, ...constraints: QueryConstraint[]) =>
    query(collectionGroup(db, 'private'), ...constraints);
  const approved = where('listingApproved', '==', true);
  const suspended = where('status', '==', 'suspended');
  const paths = (d: string[]) => d.map((id) => `distributors/${id}/private/control`).sort();

  it('lets the admin list the approved ones, with their names, in a bounded query', async () => {
    const found = await assertSucceeds(
      getDocs(controls(admin(), approved, orderBy('createdAt'), limit(PENDING_LISTINGS_LIMIT))),
    );

    const everyoneButPending = Object.values(WORLD)
      .filter((seeded) => seeded !== WORLD.pending)
      .map((seeded) => seeded.d);
    expect(found.docs.map((snapshot) => snapshot.ref.path).sort()).toEqual(
      paths(everyoneButPending),
    );
    expect(
      found.docs.every((snapshot) => snapshot.data().distributorName === DISTRIBUTOR_NAME),
    ).toBe(true);
  });

  it('lets the admin list the suspended ones, approved or not', async () => {
    await seedDoc(
      env,
      `distributors/${PENDING}/private/control`,
      controlDoc('owner-pending', { status: 'suspended', slug: WORLD.pending.slug, ...old }),
    );

    const found = await assertSucceeds(
      getDocs(controls(admin(), suspended, orderBy('createdAt'), limit(PENDING_LISTINGS_LIMIT))),
    );

    expect(found.docs.map((snapshot) => snapshot.ref.path).sort()).toEqual(
      paths([WORLD.suspended.d, PENDING]),
    );
  });

  it.each([
    ['the approved ones', approved],
    ['the suspended ones', suspended],
  ])('never returns a settings document among %s', async (_case, filter) => {
    const found = await getDocs(controls(admin(), filter, limit(PENDING_LISTINGS_LIMIT)));

    expect(found.docs.filter((snapshot) => snapshot.id !== 'control')).toEqual([]);
  });

  it.each<[string, () => QueryConstraint[]]>([
    ['the approved ones without a limit', () => [approved]],
    ['the approved ones above the cap', () => [approved, limit(PENDING_LISTINGS_LIMIT + 1)]],
    ['the suspended ones without a limit', () => [suspended]],
    ['the suspended ones above the cap', () => [suspended, limit(PENDING_LISTINGS_LIMIT + 1)]],
    ['everything, with a limit', () => [limit(10)]],
    ['everything, ordered by date', () => [orderBy('createdAt'), limit(10)]],
    ['those with another status', () => [where('status', '==', 'active'), limit(10)]],
    ['those past due', () => [where('status', '==', 'pastDue'), limit(10)]],
    ['those not suspended', () => [where('status', '!=', 'suspended'), limit(10)]],
    ['those of one founder', () => [where('ownerUid', '==', 'owner-a'), limit(10)]],
    ['those with one name', () => [where('distributorName', '==', DISTRIBUTOR_NAME), limit(10)]],
    ['those with one tax number', () => [where('taxId', '==', '20000000001'), limit(10)]],
  ])('blocks the admin from listing %s', async (_case, constraints) => {
    await assertFails(getDocs(controls(admin(), ...constraints())));
  });

  it.each([
    ['an anonymous visitor', () => anonymous(env)],
    ['a customer', () => verified(env, CUSTOMER_UID)],
    ['the owner of an approved distributor', () => verified(env, 'owner-a')],
    ['the driver of an approved distributor', () => verified(env, 'driver-a')],
    ['the owner of a suspended distributor', () => verified(env, 'owner-suspended')],
    ['the owner of a listing that waits', () => verified(env, 'owner-pending')],
  ])('blocks %s from both lists, also one row at a time', async (_who, connect) => {
    const db = connect();

    await assertFails(getDocs(controls(db, approved, limit(PENDING_LISTINGS_LIMIT))));
    await assertFails(getDocs(controls(db, approved, limit(1))));
    await assertFails(getDocs(controls(db, suspended, limit(1))));
  });

  it('blocks an owner from listing the private documents of its own distributor', async () => {
    const own = collection(verified(env, 'owner-a'), `distributors/${A}/private`);

    await assertFails(getDocs(query(own, approved, limit(1))));
    await assertFails(getDocs(query(own, limit(2))));
  });

  it('blocks a token that only claims to be admin', async () => {
    const fake = env.authenticatedContext('pretender', { admin: true, platformAdmin: true });

    await assertFails(getDocs(controls(fake.firestore(), approved, limit(1))));
  });
});

// ---------------------------------------------------------------------------------------------
// The correction mark.
// ---------------------------------------------------------------------------------------------
const mark = () => ({ correctedAt: serverTimestamp(), ...stamp });

/** What the founder sends when it corrects what it declared: the settings and the mark. */
function correctSettings(db: Db, d: string, control: Record<string, unknown> = mark()) {
  const batch = writeBatch(db);
  batch.update(settingsOf(db, d), { legalName: 'Gas Demo Corregida S.A.C.', ...stamp });
  batch.update(controlOf(db, d), control);
  return batch.commit();
}

/** What an owner sends when it corrects the public profile: the edit and the mark. */
function correctProfile(db: Db, d: string, control: Record<string, unknown> = mark()) {
  const batch = writeBatch(db);
  batch.update(profileOf(db, d), { addressLine: 'Av. Corregida 200', ...stamp });
  batch.update(controlOf(db, d), control);
  return batch.commit();
}

const sendNote = (d: string, reviewNote: string) =>
  updateDoc(controlOf(admin(), d), { reviewNote, correctedAt: deleteField(), ...stamp });

describe('answering a note of the platform — the correction mark', () => {
  const owner = () => verified(env, 'owner-pending');

  beforeEach(async () => {
    await sendNote(PENDING, NOTE);
  });

  it('lets the founder mark the correction of what it declared, and nothing opens', async () => {
    await assertSucceeds(correctSettings(owner(), PENDING));

    const control = await storedControl(PENDING);
    expect(control.correctedAt).toBeInstanceOf(Timestamp);
    expect(control.reviewNote).toBe(NOTE);
    expect(control.listingApproved).toBe(false);
    expect(control).not.toHaveProperty('approvedAt');
    await assertFails(getDoc(profileOf(anonymous(env), PENDING)));
  });

  it('lets an owner mark the correction of the public profile', async () => {
    await assertSucceeds(correctProfile(owner(), PENDING));

    expect((await storedControl(PENDING)).correctedAt).toBeInstanceOf(Timestamp);
  });

  it('lets an owner mark it together with a new name', async () => {
    await assertSucceeds(editIdentity(owner(), PENDING, { name: NEW_NAME }, mark()));

    expect(await storedControl(PENDING)).toMatchObject({
      distributorName: NEW_NAME,
      reviewNote: NOTE,
    });
  });

  it('lets an owner who did not found the distributor mark a correction of the profile', async () => {
    await seedDoc(
      env,
      `distributors/${PENDING}/members/co-owner`,
      memberDoc(PENDING, 'co-owner', 'owner', old),
    );

    await assertSucceeds(correctProfile(verified(env, 'co-owner'), PENDING));
  });

  it('lets the owner correct again later: the mark takes the new date', async () => {
    await correctSettings(owner(), PENDING);
    const first = (await storedControl(PENDING)).correctedAt as Timestamp;

    await assertSucceeds(correctProfile(owner(), PENDING));

    const second = (await storedControl(PENDING)).correctedAt as Timestamp;
    expect(second.toMillis()).toBeGreaterThanOrEqual(first.toMillis());
  });

  it('blocks the mark on its own: it travels with a correction or not at all', async () => {
    await assertFails(updateDoc(controlOf(owner(), PENDING), mark()));
  });

  it('blocks the mark next to an edit of another distributor instead of this one', async () => {
    const db = verified(env, 'owner-a');
    const batch = writeBatch(db);
    batch.update(profileOf(db, A), { addressLine: 'Av. Corregida 200', ...stamp });
    batch.update(controlOf(db, PENDING), mark());

    await assertFails(batch.commit());
  });

  it.each([
    ['a date in the past', { correctedAt: PAST }],
    ['a date in the future', { correctedAt: daysFromNow(1) }],
    ['the date as text', { correctedAt: '2026-10-11' }],
    ['the mark as true', { correctedAt: true }],
  ])('blocks a correction marked with %s', async (_case, forged) => {
    await assertFails(correctSettings(owner(), PENDING, { ...forged, ...stamp }));
    await assertFails(correctProfile(owner(), PENDING, { ...forged, ...stamp }));
  });

  // The abuse the mark must never allow: the owner deciding in place of the platform.
  it.each([
    [
      'approves itself',
      { listingApproved: true, approvedAt: serverTimestamp(), approvedBy: 'owner-pending' },
    ],
    [
      'approves itself in the name of the admin',
      { listingApproved: true, approvedAt: serverTimestamp(), approvedBy: ADMIN_UID },
    ],
    ['removes the note', { reviewNote: deleteField() }],
    ['rewrites the note', { reviewNote: 'Todo en orden.' }],
    ['makes its plan active', { status: 'active' }],
    ['extends its trial', { trialEndsAt: daysFromNow(365) }],
    ['hands the distributor to another account', { ownerUid: 'driver-pending' }],
    ['adds a field of its own', { verifiedByPlatform: true }],
  ])('blocks a correction that also %s', async (_case, extra) => {
    await assertFails(correctSettings(owner(), PENDING, { ...mark(), ...extra }));
    await assertFails(correctProfile(owner(), PENDING, { ...mark(), ...extra }));
  });

  it('blocks a correction that also lists the distributor', async () => {
    const db = owner();
    const batch = writeBatch(db);
    batch.update(profileOf(db, PENDING), { acceptingOrders: true, ...stamp });
    batch.update(controlOf(db, PENDING), mark());

    await assertFails(batch.commit());
  });

  it('blocks the owner from removing the mark once it is there', async () => {
    await correctSettings(owner(), PENDING);
    const removal = { correctedAt: deleteField(), ...stamp };

    await assertFails(updateDoc(controlOf(owner(), PENDING), removal));
    await assertFails(correctProfile(owner(), PENDING, removal));
  });

  it.each([
    ['its driver', 'driver-pending'],
    ['the owner of another distributor', 'owner-a'],
    ['a customer', CUSTOMER_UID],
  ])('blocks %s from marking a correction', async (_who, uid) => {
    const db = verified(env, uid);

    await assertFails(updateDoc(controlOf(db, PENDING), mark()));
    await assertFails(correctSettings(db, PENDING));
    await assertFails(correctProfile(db, PENDING));
  });

  it('blocks an anonymous visitor from marking a correction', async () => {
    await assertFails(correctProfile(anonymous(env), PENDING));
  });
});

describe('the correction mark — only where a note waits', () => {
  it('blocks it on a listing that waits without a note', async () => {
    const db = verified(env, 'owner-pending');

    await assertFails(correctSettings(db, PENDING));
    await assertFails(correctProfile(db, PENDING));
  });

  it('blocks it on an approved listing', async () => {
    await assertFails(correctProfile(verified(env, 'owner-a'), A));
  });

  it('blocks it on an approved listing that the same batch sends back to review', async () => {
    const db = verified(env, 'owner-a');

    await assertFails(editIdentity(db, A, { name: NEW_NAME }, mark()));
  });

  it('blocks it while the distributor is suspended: nothing can be corrected then', async () => {
    const d = WORLD.suspended.d;
    await seedDoc(
      env,
      `distributors/${d}/private/control`,
      controlDoc('owner-suspended', {
        status: 'suspended',
        slug: WORLD.suspended.slug,
        reviewNote: NOTE,
        ...old,
      }),
    );
    const db = verified(env, 'owner-suspended');

    await assertFails(correctSettings(db, d));
    await assertFails(correctProfile(db, d));
  });
});

describe('the correction mark — what the platform admin does with it', () => {
  const owner = () => verified(env, 'owner-pending');

  beforeEach(async () => {
    await sendNote(PENDING, NOTE);
  });

  it('blocks the admin from writing the mark in the name of the owner', async () => {
    await assertFails(updateDoc(controlOf(admin(), PENDING), mark()));
    await assertFails(correctProfile(admin(), PENDING));
  });

  it('blocks the admin from re-dating a mark the owner left', async () => {
    await correctSettings(owner(), PENDING);

    await assertFails(updateDoc(controlOf(admin(), PENDING), mark()));
    await assertFails(updateDoc(controlOf(admin(), PENDING), { correctedAt: PAST, ...stamp }));
  });

  it('keeps the mark when the admin only changes the status', async () => {
    await correctSettings(owner(), PENDING);

    await assertSucceeds(updateDoc(controlOf(admin(), PENDING), { status: 'suspended', ...stamp }));

    expect((await storedControl(PENDING)).correctedAt).toBeInstanceOf(Timestamp);
  });

  it('demands that a new note clears the mark: it is a new question', async () => {
    await correctSettings(owner(), PENDING);
    const control = controlOf(admin(), PENDING);

    await assertFails(updateDoc(control, { reviewNote: 'Falta el registro.', ...stamp }));
    await assertSucceeds(sendNote(PENDING, 'Falta el registro.'));
    expect(await storedControl(PENDING)).not.toHaveProperty('correctedAt');
  });

  it('demands that removing the note removes the mark with it', async () => {
    await correctSettings(owner(), PENDING);
    const control = controlOf(admin(), PENDING);

    await assertFails(updateDoc(control, { reviewNote: deleteField(), ...stamp }));
    await assertSucceeds(
      updateDoc(control, { reviewNote: deleteField(), correctedAt: deleteField(), ...stamp }),
    );
  });

  it('demands that an approval clears the mark together with the note', async () => {
    await correctSettings(owner(), PENDING);
    const approval = {
      listingApproved: true,
      approvedAt: serverTimestamp(),
      approvedBy: ADMIN_UID,
      reviewNote: deleteField(),
      ...stamp,
    };
    const approve = (control: Record<string, unknown>) => {
      const db = admin();
      const batch = writeBatch(db);
      batch.update(controlOf(db, PENDING), control);
      batch.update(profileOf(db, PENDING), { acceptingOrders: true, ...stamp });
      return batch.commit();
    };

    await assertFails(approve(approval));
    await assertSucceeds(approve({ ...approval, correctedAt: deleteField() }));
    expect(await storedControl(PENDING)).not.toHaveProperty('correctedAt');
  });
});
