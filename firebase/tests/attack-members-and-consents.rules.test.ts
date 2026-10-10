// Attacks on memberships (nobody gives itself a role), on the "my memberships" group query, on
// the consents kept in the profile and on writes to a distributor that is read-only.
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
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PRIVACY_VERSION, TERMS_VERSION } from '../../src/domain/legal/versions';
import {
  ADMIN_UID,
  anonymous,
  createEnv,
  CUSTOMER_UID,
  type Db,
  DISTRIBUTOR_NAME,
  memberDoc,
  privacyDoc,
  seedDoc,
  seedWorld,
  termsDoc,
  userDoc,
  verified,
  WORLD,
} from './helpers';

let env: RulesTestEnvironment;
const A = WORLD.a.d;
const B = WORLD.b.d;
const PAST = Timestamp.fromDate(new Date('2020-01-01T00:00:00Z'));
const FUTURE = Timestamp.fromDate(new Date('2099-01-01T00:00:00Z'));
const stamp = { updatedAt: serverTimestamp() };
const old = { createdAt: PAST, updatedAt: PAST };
const memberOf = (db: Db, d: string, uid: string) => doc(db, `distributors/${d}/members/${uid}`);

beforeAll(async () => {
  env = await createEnv('attack-members');
});

beforeEach(async () => {
  await env.clearFirestore();
  await seedWorld(env);
});

afterAll(async () => {
  await env.cleanup();
});

describe('members — giving itself a role through a batch', () => {
  it('blocks a driver from hiding a promotion behind the name correction', async () => {
    const db = verified(env, 'driver-a');
    const batch = writeBatch(db);
    batch.update(memberOf(db, A, 'driver-a'), { distributorName: DISTRIBUTOR_NAME, ...stamp });
    batch.update(memberOf(db, A, 'driver-a'), { role: 'owner', ...stamp });

    await assertFails(batch.commit());
    await assertFails(
      setDoc(memberOf(db, A, 'driver-a'), memberDoc(A, 'driver-a', 'owner'), { merge: true }),
    );
  });

  it('blocks two owners from being skipped: an owner cannot promote itself in a rename batch', async () => {
    await seedDoc(env, `distributors/${A}/members/co-owner`, memberDoc(A, 'co-owner', 'owner', old));
    const db = verified(env, 'co-owner');
    const batch = writeBatch(db);
    batch.update(doc(db, `distributors/${A}`), { name: 'Gas Demo Dos', ...stamp });
    batch.update(memberOf(db, A, 'co-owner'), { distributorName: 'Gas Demo Dos', ...stamp });
    batch.update(memberOf(db, A, 'owner-a'), {
      distributorName: 'Gas Demo Dos',
      active: false,
      ...stamp,
    });

    await assertFails(batch.commit());
  });

  it('blocks a member from re-creating its own document with set()', async () => {
    const db = verified(env, 'driver-a');
    await assertFails(setDoc(memberOf(db, A, 'driver-a'), memberDoc(A, 'driver-a', 'owner')));
    await assertFails(setDoc(memberOf(db, A, 'driver-a'), memberDoc(A, 'driver-a', 'driver')));
  });

  it('blocks a deactivated owner from reactivating itself through the name correction', async () => {
    await seedDoc(
      env,
      `distributors/${A}/members/co-owner`,
      memberDoc(A, 'co-owner', 'owner', { active: false, ...old }),
    );
    const own = memberOf(verified(env, 'co-owner'), A, 'co-owner');

    await assertFails(updateDoc(own, { active: true, ...stamp }));
    await assertFails(updateDoc(own, { distributorName: DISTRIBUTOR_NAME, active: true, ...stamp }));
    await assertFails(
      updateDoc(memberOf(verified(env, 'co-owner'), A, 'driver-a'), { active: false, ...stamp }),
    );
  });

  it('blocks an owner of A from managing a member of B, and a dispatcher from managing anyone', async () => {
    await assertFails(
      updateDoc(memberOf(verified(env, 'owner-a'), B, 'driver-b'), { active: false, ...stamp }),
    );
    await assertFails(
      updateDoc(memberOf(verified(env, 'dispatcher-a'), A, 'driver-a'), {
        displayName: 'Otro',
        ...stamp,
      }),
    );
  });

  it('blocks an owner whose role was written by nobody: the token cannot carry it', async () => {
    const fake = env
      .authenticatedContext('pretender', { role: 'owner', distributorId: A, email_verified: true })
      .firestore();
    await assertFails(updateDoc(memberOf(fake, A, 'driver-a'), { active: false, ...stamp }));
    await assertFails(getDoc(memberOf(fake, A, 'driver-a')));
    await assertFails(getDocs(query(collection(fake, `distributors/${A}/members`), limit(5))));
  });
});

describe('members — the group query "my memberships" pointed elsewhere', () => {
  const group = (db: Db) => collectionGroup(db, 'members');

  it.each([
    ['its own uid or another', () => [where('uid', 'in', ['owner-a', 'owner-b']), limit(5)]],
    ['any uid but one', () => [where('uid', '!=', 'nobody'), limit(5)]],
    ['a range of uids', () => [where('uid', '>=', 'a'), limit(5)]],
    ['one distributor', () => [where('distributorId', '==', B), limit(5)]],
    ['the active ones', () => [where('active', '==', true), limit(5)]],
    ['an order, no filter', () => [orderBy('uid'), limit(5)]],
  ])('blocks filtering by %s', async (_case, constraints) => {
    await assertFails(getDocs(query(group(verified(env, 'owner-a')), ...constraints())));
  });

  it('blocks counting the memberships of someone else or of everyone', async () => {
    const db = verified(env, 'owner-a');
    await assertFails(getCountFromServer(group(db)));
    await assertFails(getCountFromServer(query(group(db), where('uid', '==', 'owner-b'))));
  });

  it('shows nothing of B to a stranger who lists its staff filtered by its own uid', async () => {
    const db = verified(env, 'owner-a');
    const attempt = getDocs(
      query(collection(db, `distributors/${B}/members`), where('uid', '==', 'owner-a'), limit(5)),
    );
    const seen = await attempt.then(
      (found) => found.docs.map((snapshot) => snapshot.id),
      () => [],
    );
    expect(seen).toEqual([]);
  });

  it('blocks an anonymous visitor even with a well-formed query', async () => {
    const db = anonymous(env);
    await assertFails(getDocs(query(group(db), where('uid', '==', 'owner-a'), limit(5))));
  });
});

describe('consents — taking them back or dating them', () => {
  const own = () => doc(verified(env, CUSTOMER_UID), `users/${CUSTOMER_UID}`);

  it.each([
    ['removing the terms', { terms: deleteField() }],
    ['removing the privacy consent', { privacy: deleteField() }],
    ['removing both', { terms: deleteField(), privacy: deleteField() }],
    ['setting the terms to null', { terms: null }],
    ['dating the terms in the future', { terms: termsDoc({ acceptedAt: FUTURE }) }],
    ['dating the privacy consent in the past', { privacy: privacyDoc({ acceptedAt: PAST }) }],
    ['a version nobody published', { privacy: privacyDoc({ version: '0.0' }) }],
    ['a version with a space', { terms: termsDoc({ version: `${TERMS_VERSION} ` }) }],
    ['a version as a list', { terms: termsDoc({ version: [TERMS_VERSION] }) }],
    ['a nested proof', { terms: termsDoc({ proof: { ip: 'x'.repeat(1000) } }) }],
  ])('blocks %s', async (_case, change) => {
    await assertFails(updateDoc(own(), { ...change, ...stamp }));
  });

  it('blocks changing the version while keeping the old acceptance date', async () => {
    // A profile on a version that is no longer allowed: every write has to renew it, now.
    const legacy = userDoc({
      terms: { version: '0.0', acceptedAt: PAST },
      privacy: { version: PRIVACY_VERSION, acceptedAt: PAST },
      ...old,
    });
    await seedDoc(env, `users/${CUSTOMER_UID}`, legacy);

    await assertFails(updateDoc(own(), { displayName: 'C. Otra', ...stamp }));
    await assertFails(
      updateDoc(own(), { terms: { version: TERMS_VERSION, acceptedAt: PAST }, ...stamp }),
    );
    await assertSucceeds(updateDoc(own(), { terms: termsDoc(), ...stamp }));
  });

  it('blocks a profile created with the consents of another moment', async () => {
    const db = verified(env, 'newcomer');
    const fresh = doc(db, 'users/newcomer');
    await assertFails(setDoc(fresh, userDoc({ terms: termsDoc({ acceptedAt: FUTURE }) })));
    await assertFails(setDoc(fresh, userDoc({ privacy: privacyDoc({ acceptedAt: FUTURE }) })));
    await assertFails(setDoc(fresh, userDoc({ terms: null })));
  });
});

describe('ownedDistributorIds — claiming or dodging the cap', () => {
  const own = (uid: string) => doc(verified(env, uid), `users/${uid}`);

  it.each([
    ['A, founded by someone else', [A]],
    ['its own distributor twice', [A, A]],
    ['a huge list', Array.from({ length: 2000 }, (_, index) => `dist-${index}`)],
    ['a list of maps', [{ id: A }]],
    ['null', null],
  ])('blocks a customer from writing %s', async (_case, ownedDistributorIds) => {
    await assertFails(updateDoc(own(CUSTOMER_UID), { ownedDistributorIds, ...stamp }));
  });

  it('blocks a founder from swapping its distributor for another one', async () => {
    await assertFails(updateDoc(own('owner-a'), { ownedDistributorIds: [B], ...stamp }));
    await assertFails(updateDoc(own('owner-a'), { ownedDistributorIds: [A, B], ...stamp }));
    await assertFails(updateDoc(own('owner-a'), { ownedDistributorIds: deleteField(), ...stamp }));
  });

  it('does not make anyone an owner: the list is never read to grant access', async () => {
    // Even with the list forged by a script, the member document is what counts.
    await seedDoc(env, `users/${CUSTOMER_UID}`, userDoc({ ownedDistributorIds: [A], ...old }));
    const db = verified(env, CUSTOMER_UID);

    await assertFails(updateDoc(doc(db, `distributors/${A}`), { name: 'Mío', ...stamp }));
    await assertFails(getDoc(doc(db, `distributors/${A}/private/control`)));
    await assertFails(getDoc(doc(db, `distributors/${A}/private/settings`)));
    await assertFails(getDocs(query(collection(db, `distributors/${A}/members`), limit(5))));
  });
});

describe('read-only distributors — every business write that exists today', () => {
  it.each([
    ['suspended', WORLD.suspended.d, 'owner-suspended', 'driver-suspended'],
    ['on an expired trial', WORLD.expired.d, 'owner-expired', 'driver-expired'],
  ])('blocks the owner of one that is %s from managing its staff', async (_case, d, owner, driver) => {
    const target = memberOf(verified(env, owner), d, driver);
    await assertFails(updateDoc(target, { active: false, ...stamp }));
    await assertFails(updateDoc(target, { role: 'dispatcher', ...stamp }));
    await assertFails(updateDoc(target, { displayName: 'Otro', ...stamp }));
  });

  it.each([
    ['suspended', WORLD.suspended.d, 'owner-suspended'],
    ['on an expired trial', WORLD.expired.d, 'owner-expired'],
    ['past due', WORLD.pastDue.d, 'owner-past-due'],
  ])('blocks the owner of one that is %s from editing profile and contact data', async (_c, d, owner) => {
    const db = verified(env, owner);
    for (const change of [
      { contactPhone: '900000050' },
      { brandColor: '#0a7cff' },
      { coverageRadiusKm: 50 },
      { brands: ['Marca Uno'] },
      { priceFromCents: 100 },
    ]) {
      await assertFails(updateDoc(doc(db, `distributors/${d}`), { ...change, ...stamp }));
    }
    await assertFails(
      updateDoc(doc(db, `distributors/${d}/private/settings`), { ownerPhone: '900000051', ...stamp }),
    );
  });

  it('still lets the people behind it keep their own account', async () => {
    const db = verified(env, 'owner-suspended');
    await assertSucceeds(
      updateDoc(doc(db, 'users/owner-suspended'), { displayName: 'A. Otra', ...stamp }),
    );
    await assertSucceeds(getDoc(doc(db, `distributors/${WORLD.suspended.d}/private/control`)));
  });

  it('blocks a platform admin from doing the business writes of a distributor', async () => {
    const db = verified(env, ADMIN_UID);
    await assertFails(updateDoc(memberOf(db, A, 'driver-a'), { active: false, ...stamp }));
    await assertFails(
      updateDoc(doc(db, `distributors/${A}/private/settings`), { ownerName: 'X', ...stamp }),
    );
  });
});
