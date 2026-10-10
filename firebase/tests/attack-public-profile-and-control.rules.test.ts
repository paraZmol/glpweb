// Attacks on the public profile, its derived `acceptingOrders` flag and the control document
// (PLAN 2.9). Each test is an attempt that must fail; the few that must pass are the legitimate
// twin of an attack, so a rule that blocks everything does not look safe.
import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  collectionGroup,
  doc,
  documentId,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  limitToLast,
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
  ADMIN_UID,
  anonymous,
  controlDoc,
  createEnv,
  CUSTOMER_UID,
  type Db,
  distributorDoc,
  memberDoc,
  privateDoc,
  seedDoc,
  seedWorld,
  verified,
  WORLD,
} from './helpers';

let env: RulesTestEnvironment;
const PAST = Timestamp.fromDate(new Date('2020-01-01T00:00:00Z'));
const stamp = { updatedAt: serverTimestamp() };
const old = { createdAt: PAST, updatedAt: PAST };
const profile = (db: Db, d: string) => doc(db, `distributors/${d}`);
const control = (db: Db, d: string) => doc(db, `distributors/${d}/private/control`);
const UNLISTED = [WORLD.suspended.d, WORLD.pastDue.d, WORLD.expired.d];

beforeAll(async () => {
  env = await createEnv('attack-profile');
});

beforeEach(async () => {
  await env.clearFirestore();
  await seedWorld(env);
});

afterAll(async () => {
  await env.cleanup();
});

describe('control document — reading it through a side door', () => {
  it.each([
    ['an anonymous visitor', () => anonymous(env)],
    ['a customer', () => verified(env, CUSTOMER_UID)],
    ['the founder of one of them', () => verified(env, 'owner-a')],
    ['a platform admin', () => verified(env, ADMIN_UID)],
  ])('blocks %s from sweeping every control document with a group query', async (_who, connect) => {
    const db = connect();
    await assertFails(getDocs(query(collectionGroup(db, 'private'), limit(5))));
    await assertFails(
      getDocs(query(collectionGroup(db, 'private'), where('ownerUid', '==', 'owner-a'), limit(5))),
    );
    await assertFails(
      getDocs(query(collectionGroup(db, 'private'), where('status', '==', 'suspended'), limit(5))),
    );
  });

  it('blocks counting the private documents of a distributor', async () => {
    const db = verified(env, CUSTOMER_UID);
    await assertFails(getCountFromServer(collection(db, `distributors/${WORLD.a.d}/private`)));
    await assertFails(getCountFromServer(collectionGroup(db, 'private')));
  });

  it('blocks probing whether a distributor id exists through its control document', async () => {
    const db = verified(env, CUSTOMER_UID);
    await assertFails(getDoc(control(db, 'dist-ghost')));
    await assertFails(getDoc(control(db, WORLD.a.d)));
  });

  it('blocks a member of A from reading the control document of B, whatever its role', async () => {
    for (const uid of ['owner-a', 'dispatcher-a', 'driver-a']) {
      await assertFails(getDoc(control(verified(env, uid), WORLD.b.d)));
      await assertFails(getDoc(control(verified(env, uid), WORLD.suspended.d)));
    }
  });

  it('blocks a deactivated dispatcher and a deactivated co-owner', async () => {
    const d = WORLD.a.d;
    await seedDoc(
      env,
      `distributors/${d}/members/dispatcher-a`,
      memberDoc(d, 'dispatcher-a', 'dispatcher', { active: false, ...old }),
    );
    await seedDoc(
      env,
      `distributors/${d}/members/co-owner`,
      memberDoc(d, 'co-owner', 'owner', { active: false, ...old }),
    );

    await assertFails(getDoc(control(verified(env, 'dispatcher-a'), d)));
    await assertFails(getDoc(control(verified(env, 'co-owner'), d)));
  });

  it('blocks a member whose document says an unknown role', async () => {
    const d = WORLD.a.d;
    await seedDoc(
      env,
      `distributors/${d}/members/odd`,
      memberDoc(d, 'odd', 'driver', { role: 'guest', ...old }),
    );
    await assertFails(getDoc(control(verified(env, 'odd'), d)));
  });
});

describe('control document — an owner slips a change in next to a legitimate write', () => {
  it.each([
    ['its status', { status: 'active' }],
    ['its trial end', { trialEndsAt: Timestamp.fromMillis(Date.now() + 86_400_000 * 3650) }],
    ['its founder', { ownerUid: 'dispatcher-a' }],
    ['only its updatedAt', {}],
  ])('blocks a batch that edits the profile and %s', async (_case, change) => {
    const db = verified(env, 'owner-a');
    const batch = writeBatch(db);
    batch.update(profile(db, WORLD.a.d), { name: 'Gas Demo Dos', ...stamp });
    batch.update(control(db, WORLD.a.d), { ...change, ...stamp });

    await assertFails(batch.commit());

    const after = await getDoc(profile(db, WORLD.a.d));
    expect(after.data()?.name).toBe('Gas Demo');
  });

  it.each([
    ['suspended', WORLD.suspended.d, 'owner-suspended'],
    ['past due', WORLD.pastDue.d, 'owner-past-due'],
    ['on an expired trial', WORLD.expired.d, 'owner-expired'],
  ])('blocks the owner of a distributor that is %s from reopening it in one batch', async (_c, d, uid) => {
    const db = verified(env, uid);
    const batch = writeBatch(db);
    batch.update(control(db, d), { status: 'active', ...stamp });
    batch.update(profile(db, d), { acceptingOrders: true, ...stamp });

    await assertFails(batch.commit());
  });

  it('blocks the owner from replacing the control document of another distributor', async () => {
    const db = verified(env, 'owner-a');
    const batch = writeBatch(db);
    batch.set(control(db, WORLD.b.d), controlDoc('owner-a'));
    batch.update(profile(db, WORLD.a.d), { name: 'Gas Demo Dos', ...stamp });

    await assertFails(batch.commit());
  });

  it('blocks a founder from re-creating its own control document to restart the trial', async () => {
    const db = verified(env, 'owner-expired');
    const d = WORLD.expired.d;
    const batch = writeBatch(db);
    batch.set(control(db, d), controlDoc('owner-expired'));
    batch.set(profile(db, d), distributorDoc(WORLD.expired.slug));
    batch.set(doc(db, `distributors/${d}/members/owner-expired`), memberDoc(d, 'owner-expired', 'owner'));
    batch.set(doc(db, `distributors/${d}/private/settings`), privateDoc('owner-expired'));
    batch.update(doc(db, 'users/owner-expired'), stamp);

    await assertFails(batch.commit());
  });
});

describe('acceptingOrders — getting listed without the right to', () => {
  const lie = { acceptingOrders: true, ...stamp };

  it.each([
    ['its driver', WORLD.suspended.d, 'driver-suspended'],
    ['a platform admin who leaves the control document alone', WORLD.suspended.d, ADMIN_UID],
    ['the driver of one whose trial ran out', WORLD.expired.d, 'driver-expired'],
    ['the owner of one whose trial ran out', WORLD.expired.d, 'owner-expired'],
  ])('blocks listing a closed distributor: %s', async (_who, d, uid) => {
    await assertFails(updateDoc(profile(verified(env, uid), d), lie));
  });

  it('blocks the flag with a wrong type or without a fresh date', async () => {
    await seedDoc(
      env,
      `distributors/${WORLD.expired.d}`,
      distributorDoc(WORLD.expired.slug, { acceptingOrders: true, ...old }),
    );
    const own = profile(verified(env, 'driver-expired'), WORLD.expired.d);

    await assertFails(updateDoc(own, { acceptingOrders: 'false', ...stamp }));
    await assertFails(updateDoc(own, { acceptingOrders: 0, ...stamp }));
    await assertFails(updateDoc(own, { acceptingOrders: null, ...stamp }));
    await assertFails(updateDoc(own, { acceptingOrders: false }));
    await assertFails(updateDoc(own, { acceptingOrders: false, updatedAt: PAST }));
    await assertSucceeds(updateDoc(own, { acceptingOrders: false, ...stamp }));
  });

  it('blocks the staff of A from correcting the flag of B, even towards the truth', async () => {
    // B takes orders but its flag was left on false.
    await seedDoc(
      env,
      `distributors/${WORLD.b.d}`,
      distributorDoc(WORLD.b.slug, { acceptingOrders: false, ...old }),
    );
    for (const uid of ['owner-a', 'dispatcher-a', 'driver-a', CUSTOMER_UID]) {
      await assertFails(updateDoc(profile(verified(env, uid), WORLD.b.d), lie));
    }
    await assertSucceeds(updateDoc(profile(verified(env, 'driver-b'), WORLD.b.d), lie));
  });

  it('blocks a deactivated member from touching the flag', async () => {
    const d = WORLD.expired.d;
    await seedDoc(env, `distributors/${d}`, distributorDoc(WORLD.expired.slug, old));
    await seedDoc(
      env,
      `distributors/${d}/members/driver-expired`,
      memberDoc(d, 'driver-expired', 'driver', { active: false, ...old }),
    );

    await assertFails(
      updateDoc(profile(verified(env, 'driver-expired'), d), { acceptingOrders: false, ...stamp }),
    );
  });

  it('blocks an admin from opening a distributor in the control document only', async () => {
    const db = verified(env, ADMIN_UID);
    // On trial with days left: `trial` opens it, so the flag has to say so in the same batch.
    await assertFails(updateDoc(control(db, WORLD.suspended.d), { status: 'trial', ...stamp }));

    const batch = writeBatch(db);
    batch.update(control(db, WORLD.suspended.d), { status: 'trial', ...stamp });
    batch.update(profile(db, WORLD.suspended.d), lie);
    await assertSucceeds(batch.commit());
  });

  it('blocks an admin from flagging as open a trial that already ran out', async () => {
    const db = verified(env, ADMIN_UID);
    const batch = writeBatch(db);
    batch.update(control(db, WORLD.pastDue.d), { status: 'trial', ...stamp });
    batch.update(profile(db, WORLD.pastDue.d), lie);

    await assertFails(batch.commit());
  });
});

describe('trial at its edge — the clock decides, not the client', () => {
  const EDGE = 'dist-edge';
  const SECOND = 1000;

  async function seedEdge(msFromNow: number, acceptingOrders: boolean) {
    const trialEndsAt = Timestamp.fromMillis(Date.now() + msFromNow);
    await seedDoc(env, `distributors/${EDGE}`, distributorDoc('gas-borde', { acceptingOrders, ...old }));
    await seedDoc(
      env,
      `distributors/${EDGE}/private/control`,
      controlDoc('owner-edge', { trialEndsAt, ...old }),
    );
    await seedDoc(env, `distributors/${EDGE}/private/settings`, privateDoc('owner-edge', old));
    await seedDoc(
      env,
      `distributors/${EDGE}/members/owner-edge`,
      memberDoc(EDGE, 'owner-edge', 'owner', old),
    );
  }

  it('refuses every business write once the trial ended a second ago', async () => {
    await seedEdge(-SECOND, true);
    const db = verified(env, 'owner-edge');

    await assertFails(updateDoc(profile(db, EDGE), { name: 'Gas Demo Dos', ...stamp }));
    await assertFails(
      updateDoc(doc(db, `distributors/${EDGE}/private/settings`), { ownerName: 'X', ...stamp }),
    );
    await assertFails(updateDoc(profile(db, EDGE), { acceptingOrders: true, ...stamp }));
    await assertSucceeds(updateDoc(profile(db, EDGE), { acceptingOrders: false, ...stamp }));
  });

  it('still takes them while a minute of trial is left, and cannot be unlisted', async () => {
    await seedEdge(60 * SECOND, true);
    const db = verified(env, 'owner-edge');

    await assertSucceeds(updateDoc(profile(db, EDGE), { name: 'Gas Demo Dos', ...stamp }));
    await assertFails(updateDoc(profile(db, EDGE), { acceptingOrders: false, ...stamp }));
  });

  it('cannot be listed again after the trial ended, with the flag already off', async () => {
    await seedEdge(-SECOND, false);
    const db = verified(env, 'owner-edge');

    await assertFails(updateDoc(profile(db, EDGE), { acceptingOrders: true, ...stamp }));
  });
});

describe('search — queries that try to reveal distributors that are not listed', () => {
  const all = (db: Db) => collection(db, 'distributors');
  const listed = where('acceptingOrders', '==', true);

  it.each<[string, () => QueryConstraint[]]>([
    ['"different from false"', () => [where('acceptingOrders', '!=', false), limit(10)]],
    ['"not in [false]"', () => [where('acceptingOrders', 'not-in', [false]), limit(10)]],
    ['"greater than false"', () => [where('acceptingOrders', '>', false), limit(10)]],
    ['ordering by the flag', () => [orderBy('acceptingOrders', 'desc'), limit(10)]],
    ['ordering by name', () => [orderBy('name'), limit(10)]],
    ['a filter on the id', () => [where(documentId(), 'in', UNLISTED), limit(10)]],
    ['a filter on the slug', () => [where('slug', '==', WORLD.suspended.slug), limit(1)]],
    ['"the last ten"', () => [orderBy('name'), limitToLast(10)]],
    [
      'an "or" that adds the closed ones',
      () => [where('acceptingOrders', 'in', [true, false]), limit(10)],
    ],
  ])('blocks %s', async (_case, constraints) => {
    await assertFails(getDocs(query(all(anonymous(env)), ...constraints())));
  });

  it('blocks the same search over the collection group', async () => {
    const db = anonymous(env);
    await assertFails(getDocs(query(collectionGroup(db, 'distributors'), listed, limit(10))));
  });

  it('never returns a closed distributor to a query that names it', async () => {
    const db = anonymous(env);
    for (const constraints of [
      [listed, where('slug', '==', WORLD.suspended.slug), limit(10)],
      [listed, where('name', '==', 'Gas Demo'), limit(50)],
    ]) {
      const found = await assertSucceeds(getDocs(query(all(db), ...constraints)));
      const ids = found.docs.map((snapshot) => snapshot.id);
      expect(ids.filter((id) => UNLISTED.includes(id))).toEqual([]);
    }
    // Naming the ids next to the search filter is refused outright.
    await assertFails(
      getDocs(query(all(db), listed, where(documentId(), 'in', UNLISTED), limit(10))),
    );
  });

  it('blocks counting distributors without the search filter', async () => {
    const db = anonymous(env);
    await assertFails(getCountFromServer(all(db)));
    await assertFails(
      getCountFromServer(query(all(db), where('acceptingOrders', '==', false), limit(50))),
    );
  });
});
