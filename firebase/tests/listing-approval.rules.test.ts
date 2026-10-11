// PLAN 2.11 — a distributor is shown to the public only after a platform admin approved it.
// Who approves, what an approval must carry, who sees the listings that wait, and which
// accounts may found another distributor.
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
import {
  DISTRIBUTOR_SEARCH_LIMIT,
  PENDING_LISTINGS_LIMIT,
  REVIEW_NOTE_MAX_LENGTH,
} from '../../src/domain/tenancy/constants';
import { isOpenToPublic } from '../../src/domain/tenancy/listing';
import {
  ADMIN_UID,
  anonymous,
  backToReview,
  createEnv,
  CUSTOMER_UID,
  daysFromNow,
  type Db,
  foundDistributor,
  type FoundingOptions,
  newDistributorId,
  seedDoc,
  seededControlDoc,
  seedProfile,
  seedWorld,
  userDoc,
  verified,
  WORLD,
} from './helpers';

let env: RulesTestEnvironment;
const PENDING = WORLD.pending.d;
const PAST = Timestamp.fromDate(new Date('2020-01-01T00:00:00Z'));
const old = { createdAt: PAST, updatedAt: PAST };
const stamp = { updatedAt: serverTimestamp() };

const admin = () => verified(env, ADMIN_UID);
const controlOf = (db: Db, d: string) => doc(db, `distributors/${d}/private/control`);
const profileOf = (db: Db, d: string) => doc(db, `distributors/${d}`);

beforeAll(async () => {
  env = await createEnv('listing-approval');
});

beforeEach(async () => {
  await env.clearFirestore();
  await seedWorld(env);
});

afterAll(async () => {
  await env.cleanup();
});

interface ApprovalOptions {
  /** Who the approval says it is signed by. */
  uid?: string;
  /** The public flag sent with it; `null` leaves the public document untouched. */
  acceptingOrders?: boolean | null;
}

/** What a platform admin sends to approve: the signed approval and the public flag. */
function approve(db: Db, d: string, options: ApprovalOptions = {}): Promise<void> {
  const uid = options.uid ?? ADMIN_UID;
  const acceptingOrders = options.acceptingOrders === undefined ? true : options.acceptingOrders;
  const batch = writeBatch(db);
  batch.update(controlOf(db, d), {
    listingApproved: true,
    approvedAt: serverTimestamp(),
    approvedBy: uid,
    reviewNote: deleteField(),
    ...stamp,
  });
  if (acceptingOrders !== null) batch.update(profileOf(db, d), { acceptingOrders, ...stamp });
  return batch.commit();
}

/** What a platform admin sends to return a listing to its owner, with or without a note. */
function sendBack(db: Db, d: string, reviewNote?: unknown, unlist = false): Promise<void> {
  const batch = writeBatch(db);
  batch.update(controlOf(db, d), {
    ...backToReview(),
    ...(reviewNote === undefined ? {} : { reviewNote }),
  });
  if (unlist) batch.update(profileOf(db, d), { acceptingOrders: false, ...stamp });
  return batch.commit();
}

describe('approving a listing — platform admin only', () => {
  it('lets the admin approve a listing, which opens it to visitors', async () => {
    await assertFails(getDoc(profileOf(anonymous(env), PENDING)));

    await assertSucceeds(approve(admin(), PENDING));

    const control = (await getDoc(controlOf(admin(), PENDING))).data();
    expect(control?.listingApproved).toBe(true);
    expect(control?.approvedBy).toBe(ADMIN_UID);
    expect(control?.approvedAt).toBeInstanceOf(Timestamp);
    const visible = await assertSucceeds(getDoc(profileOf(anonymous(env), PENDING)));
    expect(visible.data()?.acceptingOrders).toBe(true);
  });

  it('lists it in the search once approved', async () => {
    await approve(admin(), PENDING);

    const listed = where('acceptingOrders', '==', true);
    const all = collection(anonymous(env), 'distributors');
    const found = await getDocs(query(all, listed, limit(DISTRIBUTOR_SEARCH_LIMIT)));
    expect(found.docs.map((snapshot) => snapshot.id)).toContain(PENDING);
  });

  it.each([
    ['its owner', 'owner-pending'],
    ['its driver', 'driver-pending'],
    ['the owner of another distributor', 'owner-a'],
    ['a customer', CUSTOMER_UID],
  ])('blocks %s from approving it, signed by itself or by the admin', async (_who, uid) => {
    const db = verified(env, uid);

    await assertFails(approve(db, PENDING, { uid }));
    await assertFails(approve(db, PENDING));
    await assertFails(approve(db, PENDING, { uid, acceptingOrders: null }));
    await assertFails(updateDoc(profileOf(db, PENDING), { acceptingOrders: true, ...stamp }));
  });

  it('blocks an anonymous visitor and a token that only claims to be admin', async () => {
    const fake = env.authenticatedContext('pretender', {
      admin: true,
      platformAdmin: true,
      email_verified: true,
    });

    await assertFails(approve(anonymous(env), PENDING));
    await assertFails(approve(fake.firestore(), PENDING, { uid: 'pretender' }));
  });

  it.each([
    ['without listing it', { acceptingOrders: null }],
    ['while writing "does not take orders"', { acceptingOrders: false }],
    ['signed in the name of somebody else', { uid: 'owner-pending' }],
  ])('blocks the admin from approving %s', async (_case, options) => {
    await assertFails(approve(admin(), PENDING, options));
  });

  it.each([
    ['without saying when', { approvedBy: ADMIN_UID }],
    ['without saying who', { approvedAt: serverTimestamp() }],
    ['with a made-up date', { approvedAt: PAST, approvedBy: ADMIN_UID }],
    ['with the date as text', { approvedAt: '2026-10-11', approvedBy: ADMIN_UID }],
    [
      'while leaving a note for the owner',
      { approvedAt: serverTimestamp(), approvedBy: ADMIN_UID, reviewNote: 'Todo en orden.' },
    ],
    ['with an extra field', { approvedAt: serverTimestamp(), approvedBy: ADMIN_UID, vip: true }],
  ])('blocks an approval %s', async (_case, signature) => {
    const db = admin();
    const batch = writeBatch(db);
    batch.update(controlOf(db, PENDING), { listingApproved: true, ...signature, ...stamp });
    batch.update(profileOf(db, PENDING), { acceptingOrders: true, ...stamp });

    await assertFails(batch.commit());
  });

  it('blocks an approval that changes the founder or the trial with it', async () => {
    for (const change of [{ ownerUid: ADMIN_UID }, { trialEndsAt: daysFromNow(365) }]) {
      const db = admin();
      const batch = writeBatch(db);
      batch.update(controlOf(db, PENDING), {
        listingApproved: true,
        approvedAt: serverTimestamp(),
        approvedBy: ADMIN_UID,
        ...change,
        ...stamp,
      });
      batch.update(profileOf(db, PENDING), { acceptingOrders: true, ...stamp });
      await assertFails(batch.commit());
    }
  });

  it.each([
    ['suspended', 'suspended'],
    ['past due', 'pastDue'],
  ])('approves one that is %s without listing it', async (_case, status) => {
    const db = admin();
    const pendingControl = {
      ownerUid: 'owner-pending',
      status,
      trialEndsAt: daysFromNow(20),
      listingApproved: false,
      ...old,
    };
    await seedDoc(env, `distributors/${PENDING}/private/control`, pendingControl);

    await assertFails(approve(db, PENDING));
    await assertSucceeds(approve(db, PENDING, { acceptingOrders: null }));
    await assertFails(getDoc(profileOf(anonymous(env), PENDING)));
  });

  it('keeps the signature of the approval when the admin only changes the status', async () => {
    const db = admin();
    const batch = writeBatch(db);
    batch.update(controlOf(db, WORLD.a.d), { status: 'suspended', ...stamp });
    batch.update(profileOf(db, WORLD.a.d), { acceptingOrders: false, ...stamp });
    await assertSucceeds(batch.commit());

    const control = (await getDoc(controlOf(db, WORLD.a.d))).data();
    expect(control?.listingApproved).toBe(true);
    expect(control?.approvedBy).toBe(ADMIN_UID);
  });

  it('blocks the admin from re-dating an approval or moving it to another name', async () => {
    const control = controlOf(admin(), WORLD.a.d);

    await assertFails(updateDoc(control, { approvedAt: PAST, ...stamp }));
    await assertFails(updateDoc(control, { approvedBy: 'owner-a', ...stamp }));
    await assertFails(updateDoc(control, { approvedAt: deleteField(), ...stamp }));
  });
});

describe('sending a listing back to its owner', () => {
  it('lets the admin leave a note on a listing that waits', async () => {
    await assertSucceeds(sendBack(admin(), PENDING, 'El RUC no coincide con la razón social.'));

    const seenByOwner = await getDoc(controlOf(verified(env, 'owner-pending'), PENDING));
    expect(seenByOwner.data()?.reviewNote).toBe('El RUC no coincide con la razón social.');
  });

  it('lets the admin withdraw an approval, which closes the listing to visitors', async () => {
    await assertSucceeds(sendBack(admin(), WORLD.a.d, 'Actualiza el teléfono.', true));

    await assertFails(getDoc(profileOf(anonymous(env), WORLD.a.d)));
    const control = (await getDoc(controlOf(admin(), WORLD.a.d))).data();
    expect(control).not.toHaveProperty('approvedAt');
    expect(control).not.toHaveProperty('approvedBy');
  });

  it('blocks the admin from withdrawing an approval while the listing stays public', async () => {
    await assertFails(sendBack(admin(), WORLD.a.d, 'Actualiza el teléfono.'));
  });

  it.each([
    ['an empty note', ''],
    ['a blank note', '   '],
    ['an oversized note', 'n'.repeat(REVIEW_NOTE_MAX_LENGTH + 1)],
    ['a note that is not text', 7],
    ['a note as a map', { text: 'x' }],
  ])('blocks %s', async (_case, note) => {
    await assertFails(sendBack(admin(), PENDING, note));
  });

  it('accepts a note at the maximum length', async () => {
    await assertSucceeds(sendBack(admin(), PENDING, 'n'.repeat(REVIEW_NOTE_MAX_LENGTH)));
  });

  it.each([
    ['its owner', 'owner-pending'],
    ['its driver', 'driver-pending'],
    ['the owner of another distributor', 'owner-a'],
  ])('blocks %s from writing, changing or removing the note', async (_who, uid) => {
    await sendBack(admin(), PENDING, 'Falta el número de registro.');
    const control = controlOf(verified(env, uid), PENDING);

    await assertFails(updateDoc(control, { reviewNote: 'Ya lo corregí.', ...stamp }));
    await assertFails(updateDoc(control, { reviewNote: deleteField(), ...stamp }));
  });
});

// The return to review is the owner's alone, and it carries nothing else with it.
describe('the control document of a listing that waits — who else may touch it', () => {
  it.each([
    ['its driver', 'driver-pending'],
    ['the owner of another distributor', 'owner-a'],
    ['a customer', CUSTOMER_UID],
  ])(
    'blocks %s from writing "not approved" over it, although nothing changes',
    async (_who, uid) => {
      await assertFails(updateDoc(controlOf(verified(env, uid), PENDING), backToReview()));
    },
  );

  it('lets its owner write "not approved" over it again: it is already so', async () => {
    await assertSucceeds(
      updateDoc(controlOf(verified(env, 'owner-pending'), PENDING), backToReview()),
    );
  });

  it.each([
    ['its status', { status: 'active' }],
    ['its trial end', { trialEndsAt: daysFromNow(365) }],
    ['its founder', { ownerUid: 'driver-pending' }],
    ['a note', { reviewNote: 'Ya lo corregí.' }],
  ])(
    'blocks its owner from changing %s together with the return to review',
    async (_case, change) => {
      const control = controlOf(verified(env, 'owner-pending'), PENDING);

      await assertFails(updateDoc(control, { ...backToReview(), ...change }));
    },
  );

  it('blocks an approval that never says who signed it, even once approved', async () => {
    const db = admin();
    const batch = writeBatch(db);
    batch.update(controlOf(db, PENDING), {
      listingApproved: true,
      approvedAt: serverTimestamp(),
      ...stamp,
    });
    batch.update(profileOf(db, PENDING), { acceptingOrders: true, ...stamp });

    await assertFails(batch.commit());
  });
});

describe('listings that wait for review — the platform list', () => {
  const waiting = (db: Db, ...constraints: QueryConstraint[]) =>
    query(collectionGroup(db, 'private'), ...constraints);
  const notApproved = where('listingApproved', '==', false);

  it('lets the admin list them, oldest first, with a bounded query', async () => {
    const found = await assertSucceeds(
      getDocs(waiting(admin(), notApproved, orderBy('createdAt'), limit(PENDING_LISTINGS_LIMIT))),
    );

    expect(found.docs.map((snapshot) => snapshot.ref.path)).toEqual([
      `distributors/${PENDING}/private/control`,
    ]);
  });

  it('never returns a settings document, which holds the verification data of everybody', async () => {
    const found = await getDocs(waiting(admin(), notApproved, limit(PENDING_LISTINGS_LIMIT)));

    expect(found.docs.filter((snapshot) => snapshot.id !== 'control')).toEqual([]);
  });

  it.each<[string, () => QueryConstraint[]]>([
    ['without a limit', () => [notApproved]],
    ['with a limit above the cap', () => [notApproved, limit(PENDING_LISTINGS_LIMIT + 1)]],
    ['without a filter', () => [limit(10)]],
    ['"different from true"', () => [where('listingApproved', '!=', true), limit(10)]],
    ['filtered by founder', () => [where('ownerUid', '==', 'owner-a'), limit(10)]],
    ['filtered by RUC', () => [where('taxId', '==', '20000000001'), limit(10)]],
  ])('blocks the admin from a list %s', async (_case, constraints) => {
    await assertFails(getDocs(waiting(admin(), ...constraints())));
  });

  // The approved ones are a list of their own (platform-lists-and-corrections.rules.test.ts),
  // so a filter that names both values is two lists the admin may already read, in one query.
  // It stays bounded and never returns a settings document.
  it('gives the admin nothing new with a filter that names approved and not approved', async () => {
    const both = where('listingApproved', 'in', [true, false]);

    const found = await assertSucceeds(
      getDocs(waiting(admin(), both, limit(PENDING_LISTINGS_LIMIT))),
    );

    expect(found.docs.filter((snapshot) => snapshot.id !== 'control')).toEqual([]);
    await assertFails(getDocs(waiting(admin(), both, limit(PENDING_LISTINGS_LIMIT + 1))));
    await assertFails(getDocs(waiting(admin(), both)));
  });

  it.each([
    ['an anonymous visitor', () => anonymous(env)],
    ['a customer', () => verified(env, CUSTOMER_UID)],
    ['the owner of a listing that waits', () => verified(env, 'owner-pending')],
    ['the owner of an approved distributor', () => verified(env, 'owner-a')],
  ])('blocks %s from listing them', async (_who, connect) => {
    const db = connect();

    await assertFails(getDocs(waiting(db, notApproved, limit(PENDING_LISTINGS_LIMIT))));
    await assertFails(getDocs(waiting(db, notApproved, limit(1))));
    await assertFails(
      getDocs(query(collection(db, `distributors/${PENDING}/private`), notApproved, limit(1))),
    );
  });
});

describe('agreement with the domain — what "takes orders" means', () => {
  it.each(Object.values(WORLD))(
    'accepts for $d only the flag isOpenToPublic gives',
    async (seeded) => {
      const expected = isOpenToPublic(
        {
          status: seeded.status,
          trialEndsAt: seeded.trialEndsAt.toDate(),
          listingApproved: seeded !== WORLD.pending,
        },
        new Date(),
      );
      // Leave the public flag wrong, so that only the right value is a change.
      const current = (await getDoc(profileOf(admin(), seeded.d))).data() ?? {};
      await seedDoc(env, `distributors/${seeded.d}`, { ...current, acceptingOrders: !expected });
      const flag = profileOf(admin(), seeded.d);

      await assertFails(updateDoc(flag, { acceptingOrders: !expected, ...stamp }));
      await assertSucceeds(updateDoc(flag, { acceptingOrders: expected, ...stamp }));
    },
  );
});

// A read-only distributor is not escaped by founding another one with thirty fresh days.
describe('founding another distributor — blocked while one is read-only', () => {
  const FOUNDER = 'serial-founder';
  const NEW = {
    d: newDistributorId('Next'),
    uid: FOUNDER,
    slug: 'gas-siguiente',
  } satisfies FoundingOptions;

  async function seedOwned(controls: Record<string, Record<string, unknown>>) {
    await seedProfile(env, FOUNDER);
    await seedDoc(
      env,
      `users/${FOUNDER}`,
      userDoc({ ownedDistributorIds: Object.keys(controls), ...old }),
    );
    for (const [d, change] of Object.entries(controls)) {
      await seedDoc(env, `distributors/${d}/private/control`, seededControlDoc(FOUNDER, change));
    }
  }

  it.each([
    ['one that is active', { status: 'active' }],
    ['one on a running trial', { status: 'trial', trialEndsAt: daysFromNow(5) }],
  ])('lets an account that owns %s found another', async (_case, control) => {
    await seedOwned({ 'dist-owned-1': control });

    await assertSucceeds(foundDistributor(verified(env, FOUNDER), NEW));
  });

  it('lets an account whose only distributor still waits for its review found another', async () => {
    await seedProfile(env, FOUNDER);
    await seedDoc(
      env,
      `users/${FOUNDER}`,
      userDoc({ ownedDistributorIds: ['dist-owned-1'], ...old }),
    );
    await seedDoc(env, 'distributors/dist-owned-1/private/control', {
      ownerUid: FOUNDER,
      status: 'trial',
      trialEndsAt: daysFromNow(5),
      listingApproved: false,
      ...old,
    });

    await assertSucceeds(foundDistributor(verified(env, FOUNDER), NEW));
  });

  it.each([
    ['suspended', { status: 'suspended' }],
    ['past due', { status: 'pastDue' }],
    ['on a trial that ran out', { status: 'trial', trialEndsAt: PAST }],
  ])('blocks an account that owns one that is %s', async (_case, control) => {
    await seedOwned({ 'dist-owned-1': control });

    await assertFails(foundDistributor(verified(env, FOUNDER), NEW));
  });

  it.each([
    [
      'the first',
      { 'dist-owned-1': { status: 'suspended' }, 'dist-owned-2': { status: 'active' } },
    ],
    [
      'the second',
      { 'dist-owned-1': { status: 'active' }, 'dist-owned-2': { status: 'suspended' } },
    ],
  ])('blocks an account with two when %s is read-only', async (_case, controls) => {
    await seedOwned(controls);

    await assertFails(foundDistributor(verified(env, FOUNDER), NEW));
  });

  it('lets an account with two healthy distributors found its third', async () => {
    await seedOwned({ 'dist-owned-1': { status: 'active' }, 'dist-owned-2': { status: 'active' } });

    await assertSucceeds(foundDistributor(verified(env, FOUNDER), NEW));
  });

  it('blocks an account whose earlier distributor lost its control document', async () => {
    await seedProfile(env, FOUNDER);
    await seedDoc(env, `users/${FOUNDER}`, userDoc({ ownedDistributorIds: ['dist-gone'], ...old }));

    await assertFails(foundDistributor(verified(env, FOUNDER), NEW));
  });
});
