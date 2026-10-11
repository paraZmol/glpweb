import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  collectionGroup,
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
  where,
  writeBatch,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { MEMBERS_QUERY_LIMIT, MEMBERSHIPS_QUERY_LIMIT } from '../../src/domain/tenancy/constants';
import { MEMBER_ROLES } from '../../src/domain/tenancy/types';
import {
  ADMIN_UID,
  anonymous,
  createEnv,
  CUSTOMER_UID,
  type Db,
  DISTRIBUTOR_NAME,
  distributorDoc,
  memberDoc,
  seedDoc,
  seedWorld,
  unverified,
  verified,
  WORLD,
  backToReview,
} from './helpers';

let env: RulesTestEnvironment;
const A = WORLD.a.d;
const B = WORLD.b.d;
const PAST = Timestamp.fromDate(new Date('2020-01-01T00:00:00Z'));
const stamp = { updatedAt: serverTimestamp() };
const memberPath = (d: string, uid: string) => `distributors/${d}/members/${uid}`;
const memberOf = (db: Db, d: string, uid: string) => doc(db, memberPath(d, uid));

beforeAll(async () => {
  env = await createEnv('members');
});

beforeEach(async () => {
  await env.clearFirestore();
  await seedWorld(env);
});

afterAll(async () => {
  await env.cleanup();
});

describe('members — read', () => {
  it.each(['owner-a', 'dispatcher-a', 'driver-a'])(
    'lets %s read its own membership',
    async (uid) => {
      await assertSucceeds(getDoc(memberOf(verified(env, uid), A, uid)));
    },
  );

  it.each(['owner-a', 'dispatcher-a'])('lets %s read and list the staff', async (uid) => {
    const db = verified(env, uid);
    await assertSucceeds(getDoc(memberOf(db, A, 'driver-a')));
    const staff = await assertSucceeds(
      getDocs(query(collection(db, `distributors/${A}/members`), limit(MEMBERS_QUERY_LIMIT))),
    );
    expect(staff.size).toBe(3);
  });

  it('blocks an unbounded or oversized staff list', async () => {
    const staff = collection(verified(env, 'owner-a'), `distributors/${A}/members`);
    await assertFails(getDocs(staff));
    await assertFails(getDocs(query(staff, limit(MEMBERS_QUERY_LIMIT + 1))));
  });

  it.each([
    ['an anonymous visitor', () => anonymous(env)],
    ['a customer', () => verified(env, CUSTOMER_UID)],
    ['its own driver', () => verified(env, 'driver-a')],
    ['the owner of another distributor', () => verified(env, 'owner-b')],
    ['the dispatcher of another distributor', () => verified(env, 'dispatcher-b')],
    ['a driver of another distributor', () => verified(env, 'driver-b')],
  ])('blocks %s from reading other members or the staff list', async (_who, connect) => {
    const db = connect();
    await assertFails(getDoc(memberOf(db, A, 'owner-a')));
    await assertFails(getDocs(query(collection(db, `distributors/${A}/members`), limit(10))));
  });

  it('blocks a deactivated dispatcher from listing the staff', async () => {
    const deactivated = memberDoc(A, 'dispatcher-a', 'dispatcher', {
      active: false,
      createdAt: PAST,
      updatedAt: PAST,
    });
    await seedDoc(env, memberPath(A, 'dispatcher-a'), deactivated);
    const db = verified(env, 'dispatcher-a');
    await assertFails(getDocs(query(collection(db, `distributors/${A}/members`), limit(10))));
    await assertFails(getDoc(memberOf(db, A, 'driver-a')));
  });

  it('still lets the staff of a suspended distributor read (suspension is read-only)', async () => {
    const d = WORLD.suspended.d;
    const db = verified(env, 'owner-suspended');
    await assertSucceeds(getDocs(query(collection(db, `distributors/${d}/members`), limit(10))));
  });
});

describe('members — my memberships (collection group)', () => {
  const mine = (db: Db, uid: string, max = MEMBERSHIPS_QUERY_LIMIT) =>
    query(collectionGroup(db, 'members'), where('uid', '==', uid), limit(max));

  it('lets an account find its own memberships across distributors', async () => {
    await seedDoc(
      env,
      memberPath(B, 'driver-a'),
      memberDoc(B, 'driver-a', 'dispatcher', { createdAt: PAST, updatedAt: PAST }),
    );

    const found = await assertSucceeds(getDocs(mine(verified(env, 'driver-a'), 'driver-a')));

    const places = found.docs.map((snapshot) => snapshot.data().distributorId).sort();
    expect(places).toEqual([A, B].sort());
  });

  it('works for an unverified account and for one without memberships', async () => {
    const found = await assertSucceeds(getDocs(mine(unverified(env, CUSTOMER_UID), CUSTOMER_UID)));
    expect(found.empty).toBe(true);
  });

  it('blocks looking up the memberships of someone else', async () => {
    await assertFails(getDocs(mine(verified(env, 'owner-b'), 'owner-a')));
    await assertFails(getDocs(mine(verified(env, ADMIN_UID), 'owner-a')));
    await assertFails(getDocs(mine(anonymous(env), 'owner-a')));
  });

  it.each([
    ['without a uid filter', (db: Db) => query(collectionGroup(db, 'members'), limit(5))],
    [
      'filtered by role',
      (db: Db) => query(collectionGroup(db, 'members'), where('role', '==', 'owner'), limit(5)),
    ],
    [
      'without a limit',
      (db: Db) => query(collectionGroup(db, 'members'), where('uid', '==', 'owner-a')),
    ],
    ['with an oversized limit', (db: Db) => mine(db, 'owner-a', MEMBERSHIPS_QUERY_LIMIT + 1)],
  ])('blocks a collection-group query %s', async (_case, build) => {
    await assertFails(getDocs(build(verified(env, 'owner-a'))));
  });
});

describe('members — nobody gives itself a role (PLAN fase 2 criterio)', () => {
  it.each([...MEMBER_ROLES])('blocks a customer from joining a distributor as %s', async (role) => {
    const db = verified(env, CUSTOMER_UID);
    await assertFails(setDoc(memberOf(db, A, CUSTOMER_UID), memberDoc(A, CUSTOMER_UID, role)));
  });

  it('blocks claiming ownership of a distributor that does not exist', async () => {
    const db = verified(env, CUSTOMER_UID);
    const claim = memberDoc('dist-ghost', CUSTOMER_UID, 'owner');
    await assertFails(setDoc(memberOf(db, 'dist-ghost', CUSTOMER_UID), claim));
  });

  it.each([
    ['a driver promoting itself to owner', 'driver-a', { role: 'owner' }],
    ['a dispatcher promoting itself to owner', 'dispatcher-a', { role: 'owner' }],
    ['an owner changing its own role', 'owner-a', { role: 'dispatcher' }],
    ['an owner deactivating itself', 'owner-a', { active: false }],
    ['a driver renaming itself', 'driver-a', { displayName: 'Otro Nombre' }],
  ])('blocks %s', async (_case, uid, change) => {
    await assertFails(updateDoc(memberOf(verified(env, uid), A, uid), { ...change, ...stamp }));
  });

  it('blocks a co-owner, who is not the founder, from changing its own membership', async () => {
    const coOwner = memberDoc(A, 'co-owner', 'owner', { createdAt: PAST, updatedAt: PAST });
    await seedDoc(env, memberPath(A, 'co-owner'), coOwner);
    const own = memberOf(verified(env, 'co-owner'), A, 'co-owner');

    await assertFails(updateDoc(own, { role: 'dispatcher', ...stamp }));
    await assertFails(updateDoc(own, { displayName: 'Otro Nombre', ...stamp }));
  });

  it('blocks a deactivated member from reactivating itself', async () => {
    const deactivated = memberDoc(A, 'driver-a', 'driver', {
      active: false,
      createdAt: PAST,
      updatedAt: PAST,
    });
    await seedDoc(env, memberPath(A, 'driver-a'), deactivated);
    const own = memberOf(verified(env, 'driver-a'), A, 'driver-a');
    await assertFails(updateDoc(own, { active: true, ...stamp }));
  });

  it('blocks a member of B from re-creating itself inside A', async () => {
    const db = verified(env, 'owner-b');
    await assertFails(setDoc(memberOf(db, A, 'owner-b'), memberDoc(A, 'owner-b', 'owner')));
  });
});

describe('members — an owner manages the staff', () => {
  const NEWBIE = 'newbie';

  // Staff joins only by accepting an invitation (phase 3): an owner cannot enrol an account
  // that never agreed to it.
  it.each([...MEMBER_ROLES])('blocks the owner from adding a member as %s', async (role) => {
    const db = verified(env, 'owner-a');
    await assertFails(setDoc(memberOf(db, A, NEWBIE), memberDoc(A, NEWBIE, role)));
  });

  it('lets the owner change the role, the name and the active flag of a member', async () => {
    const driver = memberOf(verified(env, 'owner-a'), A, 'driver-a');
    await assertSucceeds(updateDoc(driver, { role: 'dispatcher', ...stamp }));
    await assertSucceeds(updateDoc(driver, { active: false, displayName: 'D. Otro', ...stamp }));
  });

  it.each([
    ['an anonymous visitor', () => anonymous(env)],
    ['a customer', () => verified(env, CUSTOMER_UID)],
    ['its dispatcher', () => verified(env, 'dispatcher-a')],
    ['its driver', () => verified(env, 'driver-a')],
    ['the owner of another distributor', () => verified(env, 'owner-b')],
    ['the dispatcher of another distributor', () => verified(env, 'dispatcher-b')],
    ['a platform admin', () => verified(env, ADMIN_UID)],
  ])('blocks %s from adding, changing or removing members', async (_who, connect) => {
    const db = connect();
    await assertFails(setDoc(memberOf(db, A, NEWBIE), memberDoc(A, NEWBIE, 'driver')));
    await assertFails(updateDoc(memberOf(db, A, 'driver-a'), { role: 'owner', ...stamp }));
    await assertFails(updateDoc(memberOf(db, A, 'driver-a'), { active: false, ...stamp }));
    await assertFails(deleteDoc(memberOf(db, A, 'driver-a')));
  });

  it.each([
    ['an unknown role', { role: 'superuser' }],
    ['active as a number', { active: 1 }],
    ['the uid', { uid: 'someone-else' }],
    ['the distributor id', { distributorId: B }],
    ['createdAt', { createdAt: serverTimestamp() }],
    ['an extra field', { salary: 1000 }],
    ['an oversized name', { displayName: 'n'.repeat(81) }],
    ['another distributor name', { distributorName: 'Otra Distribuidora' }],
    ['a role and another distributor name', { role: 'dispatcher', distributorName: 'Otra' }],
  ])('blocks the owner from changing a member to have %s', async (_case, change) => {
    const driver = memberOf(verified(env, 'owner-a'), A, 'driver-a');
    await assertFails(updateDoc(driver, { ...change, ...stamp }));
  });

  it('blocks a change without a fresh updatedAt', async () => {
    const driver = memberOf(verified(env, 'owner-a'), A, 'driver-a');
    await assertFails(updateDoc(driver, { role: 'dispatcher' }));
  });

  it('blocks the owner from deleting a member: staff is deactivated, never erased', async () => {
    await assertFails(deleteDoc(memberOf(verified(env, 'owner-a'), A, 'driver-a')));
  });

  it('blocks an owner of A from touching the staff of B (aislamiento A/B)', async () => {
    const db = verified(env, 'owner-a');
    await assertFails(setDoc(memberOf(db, B, 'owner-a'), memberDoc(B, 'owner-a', 'owner')));
    await assertFails(setDoc(memberOf(db, B, NEWBIE), memberDoc(B, NEWBIE, 'driver')));
    await assertFails(updateDoc(memberOf(db, B, 'driver-b'), { active: false, ...stamp }));
    await assertFails(updateDoc(memberOf(db, B, 'owner-b'), { role: 'driver', ...stamp }));
  });

  it.each([
    ['suspended', WORLD.suspended, 'owner-suspended', 'driver-suspended'],
    ['on an expired trial', WORLD.expired, 'owner-expired', 'driver-expired'],
  ] as const)(
    'blocks staff changes in a distributor that is %s',
    async (_case, seeded, owner, driver) => {
      const db = verified(env, owner);
      await assertFails(
        setDoc(memberOf(db, seeded.d, NEWBIE), memberDoc(seeded.d, NEWBIE, 'driver')),
      );
      await assertFails(updateDoc(memberOf(db, seeded.d, driver), { active: false, ...stamp }));
    },
  );

  it('keeps the distributor with an owner: a co-owner cannot demote or deactivate the founder', async () => {
    const coOwner = memberDoc(A, 'co-owner', 'owner', { createdAt: PAST, updatedAt: PAST });
    await seedDoc(env, memberPath(A, 'co-owner'), coOwner);
    const founder = memberOf(verified(env, 'co-owner'), A, 'owner-a');

    await assertFails(updateDoc(founder, { role: 'driver', ...stamp }));
    await assertFails(updateDoc(founder, { active: false, ...stamp }));
  });

  it('lets the founder demote a co-owner', async () => {
    const coOwner = memberDoc(A, 'co-owner', 'owner', { createdAt: PAST, updatedAt: PAST });
    await seedDoc(env, memberPath(A, 'co-owner'), coOwner);
    const target = memberOf(verified(env, 'owner-a'), A, 'co-owner');

    await assertSucceeds(updateDoc(target, { role: 'dispatcher', ...stamp }));
  });

  it('blocks an owner who was deactivated from managing the staff', async () => {
    const deactivated = memberDoc(A, 'co-owner', 'owner', {
      active: false,
      createdAt: PAST,
      updatedAt: PAST,
    });
    await seedDoc(env, memberPath(A, 'co-owner'), deactivated);
    const driver = memberOf(verified(env, 'co-owner'), A, 'driver-a');

    await assertFails(updateDoc(driver, { active: false, ...stamp }));
  });
});

// PLAN 2.9: each membership carries the name of its distributor, so the selector reads nothing
// extra. The copy can only ever be written equal to the public name.
describe('members — the copy of the distributor name', () => {
  const RENAMED = 'Gas Demo Renombrado';
  const rename = { distributorName: RENAMED, ...stamp };

  /** The public name changed and the copies were left behind (more staff than one batch). */
  async function seedRenamed(d = A) {
    const renamed = distributorDoc(WORLD.a.slug, {
      name: RENAMED,
      createdAt: PAST,
      updatedAt: PAST,
    });
    await seedDoc(env, `distributors/${d}`, renamed);
  }

  it.each(['owner-a', 'dispatcher-a', 'driver-a'])(
    'lets %s bring its own copy up to date',
    async (uid) => {
      await seedRenamed();
      await assertSucceeds(updateDoc(memberOf(verified(env, uid), A, uid), rename));
    },
  );

  it('lets an owner bring the copy of anyone up to date, the founder included', async () => {
    await seedRenamed();
    const coOwner = memberDoc(A, 'co-owner', 'owner', { createdAt: PAST, updatedAt: PAST });
    await seedDoc(env, memberPath(A, 'co-owner'), coOwner);
    const db = verified(env, 'co-owner');

    await assertSucceeds(updateDoc(memberOf(db, A, 'driver-a'), rename));
    await assertSucceeds(updateDoc(memberOf(db, A, 'owner-a'), rename));
  });

  it('lets the owner rename the distributor and every copy in one batch', async () => {
    const db = verified(env, 'owner-a');
    const batch = writeBatch(db);
    // PLAN 2.11: a new name sends the listing back to review in the same batch.
    batch.update(doc(db, `distributors/${A}`), { name: RENAMED, acceptingOrders: false, ...stamp });
    batch.update(doc(db, `distributors/${A}/private/control`), backToReview());
    for (const uid of Object.keys(WORLD.a.members)) batch.update(memberOf(db, A, uid), rename);

    await assertSucceeds(batch.commit());
  });

  it('blocks the rename batch when it leaves the listing approved', async () => {
    const db = verified(env, 'owner-a');
    const batch = writeBatch(db);
    batch.update(doc(db, `distributors/${A}`), { name: RENAMED, ...stamp });
    for (const uid of Object.keys(WORLD.a.members)) batch.update(memberOf(db, A, uid), rename);

    await assertFails(batch.commit());
  });

  it.each([
    ['a name the distributor does not have', { distributorName: 'Inventado', ...stamp }],
    ['the new name before the distributor has it', rename],
    ['an empty name', { distributorName: '', ...stamp }],
    ['the name without a fresh updatedAt', { distributorName: DISTRIBUTOR_NAME }],
  ])('blocks writing %s', async (_case, change) => {
    await assertFails(updateDoc(memberOf(verified(env, 'driver-a'), A, 'driver-a'), change));
    await assertFails(updateDoc(memberOf(verified(env, 'owner-a'), A, 'driver-a'), change));
  });

  it('blocks using the correction to change anything else', async () => {
    await seedRenamed();
    const own = memberOf(verified(env, 'driver-a'), A, 'driver-a');

    await assertFails(updateDoc(own, { ...rename, role: 'owner' }));
    await assertFails(updateDoc(own, { ...rename, displayName: 'Otro Nombre' }));
    await assertFails(updateDoc(own, { ...rename, active: true, uid: 'owner-a' }));
  });

  it.each([
    ['an anonymous visitor', () => anonymous(env)],
    ['a customer', () => verified(env, CUSTOMER_UID)],
    ['its dispatcher', () => verified(env, 'dispatcher-a')],
    ['the owner of another distributor', () => verified(env, 'owner-b')],
    ['a platform admin', () => verified(env, ADMIN_UID)],
  ])('blocks %s from correcting the copy of someone else', async (_who, connect) => {
    await seedRenamed();
    await assertFails(updateDoc(memberOf(connect(), A, 'driver-a'), rename));
  });

  it('blocks an owner of A from renaming B through its members (aislamiento A/B)', async () => {
    const db = verified(env, 'owner-a');
    const batch = writeBatch(db);
    batch.update(doc(db, `distributors/${B}`), { name: RENAMED, ...stamp });
    batch.update(memberOf(db, B, 'driver-b'), rename);

    await assertFails(batch.commit());
  });

  it('keeps the rename closed for a suspended distributor', async () => {
    const d = WORLD.suspended.d;
    const db = verified(env, 'owner-suspended');
    const batch = writeBatch(db);
    batch.update(doc(db, `distributors/${d}`), { name: RENAMED, ...stamp });
    batch.update(memberOf(db, d, 'driver-suspended'), rename);

    await assertFails(batch.commit());
  });
});

describe('everything not opened yet stays closed', () => {
  it.each([
    'invites/token-1',
    'helpers/h1',
    'vehicles/v1',
    'products/p1',
    'plantStock/p1',
    'customers/c1',
    'orders/o1',
    'orders/o1/history/h1',
    'shifts/s1',
    'members/owner-a/secrets/s1',
  ])('blocks the owner and the admin on distributors/{d}/%s', async (suffix) => {
    const path = `distributors/${A}/${suffix}`;
    await seedDoc(env, path, { seeded: true });
    for (const uid of ['owner-a', ADMIN_UID]) {
      const db = verified(env, uid);
      await assertFails(getDoc(doc(db, path)));
      await assertFails(setDoc(doc(db, path), { role: 'owner' }));
      await assertFails(deleteDoc(doc(db, path)));
    }
  });

  it('blocks accepting an invitation by writing the invite or the member directly', async () => {
    await seedDoc(env, `distributors/${A}/invites/token-1`, { role: 'driver' });
    const db = verified(env, CUSTOMER_UID);
    await assertFails(getDoc(doc(db, `distributors/${A}/invites/token-1`)));
    await assertFails(setDoc(memberOf(db, A, CUSTOMER_UID), memberDoc(A, CUSTOMER_UID, 'driver')));
  });

  it.each(['settings/app', 'members/owner-a', 'orders/o1', 'mail/m1'])(
    'blocks the top-level path %s',
    async (path) => {
      const db = verified(env, ADMIN_UID);
      await assertFails(getDoc(doc(db, path)));
      await assertFails(setDoc(doc(db, path), { a: 1 }));
    },
  );
});
