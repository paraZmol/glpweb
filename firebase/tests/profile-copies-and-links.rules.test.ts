// PLAN §11 (2026-10-15): copies and links added after the reviews of phase 3.
// - An invitation may carry who invites (`invitedByName`) and the brand colour (`brandColor`),
//   each written only as the truth; invitations without them stay valid.
// - The public profile keeps the weight of the product its "desde" price comes from
//   (`priceFromWeightKg`), written like the other copies of the catalogue by the owner and the
//   dispatcher.
// - The public profile may link the distributor's virtual complaints book
//   (`complaintsBookUrl`): the owner edits it without a new review.
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
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { COMPLAINTS_BOOK_URL_MAX_LENGTH, MAX_WEIGHT_KG } from '../../src/domain/tenancy/constants';
import {
  anonymous,
  createEnv,
  CUSTOMER_UID,
  type Db,
  DISTRIBUTOR_NAME,
  distributorDoc,
  foundDistributor,
  INVITE_CODE,
  inviteDoc,
  invitePath,
  joinWith,
  memberDoc,
  newDistributorId,
  seedDoc,
  seedInvite,
  seedWorld,
  verified,
  WORLD,
} from './helpers';

let env: RulesTestEnvironment;
const A = WORLD.a.d;
const B = WORLD.b.d;
const NEW_CODE = 'Invite0000000000000N';
/** What `memberDoc` names every seeded member, the founder of A included. */
const MEMBER_NAME = 'A. Persona';
/** The colour `distributorDoc` gives every seeded distributor. */
const SEEDED_COLOR = '#d9480f';
const PAST = Timestamp.fromDate(new Date('2026-02-01T12:00:00Z'));
const stamp = { updatedAt: serverTimestamp() };
const BOOK = 'https://example.com/libro-de-reclamaciones?empresa=gas-demo';

const as = (uid: string) => verified(env, uid);
const profileOf = (db: Db, d = A) => doc(db, `distributors/${d}`);
const editProfile = (uid: string, change: Record<string, unknown>, d = A) =>
  updateDoc(profileOf(as(uid), d), { ...change, ...stamp });
const invite = (uid: string, change: Record<string, unknown>, d = A) =>
  setDoc(doc(as(uid), invitePath(d, NEW_CODE)), inviteDoc({ createdBy: uid, ...change }));

beforeAll(async () => {
  env = await createEnv('profile-copies-and-links');
});

beforeEach(async () => {
  await env.clearFirestore();
  await seedWorld(env);
});

afterAll(async () => {
  await env.cleanup();
});

// ================================================================== copies in an invitation ====
describe('invitation — who invites and in which colour', () => {
  it('lets the founder copy its own name and the brand colour', async () => {
    await assertSucceeds(
      invite('owner-a', { invitedByName: MEMBER_NAME, brandColor: SEEDED_COLOR }),
    );
  });

  it('lets an owner leave both copies out, as before', async () => {
    await assertSucceeds(invite('owner-a', {}));
  });

  it.each([
    ['a name other than its own', { invitedByName: 'La Plataforma' }],
    ['the name of another member', { invitedByName: 'B. Persona' }],
    ['a name as a number', { invitedByName: 42 }],
    ['an empty name', { invitedByName: '' }],
    ['a null name', { invitedByName: null }],
    ['another colour', { brandColor: '#000000' }],
    ['a colour in capitals', { brandColor: SEEDED_COLOR.toUpperCase() }],
    ['a null colour', { brandColor: null }],
    ['a field of its own', { invitedByPhone: '900000001' }],
  ])('rejects an invitation that carries %s', async (_case, change) => {
    await assertFails(invite('owner-a', change));
  });

  it('rejects copying an invisible name, even when the member carries it', async () => {
    const invisible = '\u200b';
    await seedDoc(
      env,
      `distributors/${A}/members/owner-a`,
      memberDoc(A, 'owner-a', 'owner', {
        displayName: invisible,
        createdAt: PAST,
        updatedAt: PAST,
      }),
    );

    await assertFails(invite('owner-a', { invitedByName: invisible }));
    await assertSucceeds(invite('owner-a', { brandColor: SEEDED_COLOR }));
  });

  it('rejects the owner of B copying its name into an invitation of A', async () => {
    await assertFails(invite('owner-b', { invitedByName: MEMBER_NAME }));
  });

  it('rejects the copies from a dispatcher, which cannot invite', async () => {
    await assertFails(
      invite('dispatcher-a', { invitedByName: MEMBER_NAME, brandColor: SEEDED_COLOR }),
    );
  });

  it('rejects changing either copy once the invitation waits', async () => {
    await seedInvite(env, A, INVITE_CODE, { invitedByName: MEMBER_NAME, brandColor: SEEDED_COLOR });
    const target = doc(as('owner-a'), invitePath(A, INVITE_CODE));

    await assertFails(updateDoc(target, { invitedByName: 'Otra Persona', ...stamp }));
    await assertFails(updateDoc(target, { brandColor: '#0a7cff', ...stamp }));
    await assertFails(updateDoc(target, { brandColor: deleteField(), ...stamp }));
  });

  it('lets whoever holds the link read the copies', async () => {
    await seedInvite(env, A, INVITE_CODE, { invitedByName: MEMBER_NAME, brandColor: SEEDED_COLOR });

    const snapshot = await assertSucceeds(
      getDoc(doc(as(CUSTOMER_UID), invitePath(A, INVITE_CODE))),
    );
    expect(snapshot.data()).toMatchObject({ invitedByName: MEMBER_NAME, brandColor: SEEDED_COLOR });
  });

  it.each([
    ['with the copies', { invitedByName: MEMBER_NAME, brandColor: SEEDED_COLOR }],
    ['without them (created before they existed)', {}],
  ])('lets an account join through an invitation %s', async (_case, copies) => {
    await seedInvite(env, A, INVITE_CODE, copies);

    await assertSucceeds(
      joinWith(as(CUSTOMER_UID), { d: A, code: INVITE_CODE, uid: CUSTOMER_UID }),
    );
  });

  it('lets the rename batch refresh the name of an invitation that carries the copies', async () => {
    await seedInvite(env, A, INVITE_CODE, { invitedByName: MEMBER_NAME, brandColor: SEEDED_COLOR });
    const target = doc(as('owner-a'), invitePath(A, INVITE_CODE));

    // The public name has not changed: rewriting it equal is the refresh the rename batch sends.
    await assertSucceeds(updateDoc(target, { distributorName: DISTRIBUTOR_NAME, ...stamp }));
  });
});

// =========================================================== the weight of the "desde" price ====
describe('public profile — the weight of the "desde" price', () => {
  it.each([
    ['the owner', 'owner-a'],
    ['the dispatcher', 'dispatcher-a'],
  ])('lets %s write the price and its weight together', async (_who, uid) => {
    await assertSucceeds(editProfile(uid, { priceFromCents: 4800, priceFromWeightKg: 10 }));
  });

  it('lets the dispatcher write only the weight when only the weight changes', async () => {
    await assertSucceeds(editProfile('dispatcher-a', { priceFromWeightKg: 5 }));
  });

  it('lets the dispatcher clear the weight with the price', async () => {
    await assertSucceeds(
      editProfile('dispatcher-a', { brands: [], priceFromCents: null, priceFromWeightKg: null }),
    );
  });

  it('rejects the dispatcher rewriting the weight it already holds', async () => {
    await seedDoc(env, `distributors/${A}`, {
      ...(await storedProfile(A)),
      priceFromWeightKg: 10,
    });
    await assertFails(editProfile('dispatcher-a', { priceFromWeightKg: 10 }));
  });

  it.each([
    ['zero', 0],
    ['above the cap', MAX_WEIGHT_KG + 1],
    ['with decimals', 10.5],
    ['as text', '10'],
    ['negative', -10],
  ])('rejects a weight %s', async (_case, weight) => {
    await assertFails(editProfile('owner-a', { priceFromWeightKg: weight }));
    await assertFails(editProfile('dispatcher-a', { priceFromWeightKg: weight }));
  });

  it.each([
    ['a driver', 'driver-a', A],
    ['the owner of B', 'owner-b', A],
    ['the dispatcher of B', 'dispatcher-b', A],
    ['a customer', CUSTOMER_UID, A],
    ['the owner of a suspended distributor', 'owner-suspended', WORLD.suspended.d],
  ])('rejects %s writing the weight', async (_who, uid, d) => {
    await assertFails(editProfile(uid, { priceFromWeightKg: 15 }, d));
  });

  it('rejects an anonymous visitor writing the weight', async () => {
    await assertFails(updateDoc(profileOf(anonymous(env)), { priceFromWeightKg: 15, ...stamp }));
  });

  describe('in the founding batch', () => {
    const found = (distributorChange: Record<string, unknown>, member?: Record<string, unknown>) =>
      foundDistributor(as(CUSTOMER_UID), {
        d: newDistributorId('Copies'),
        uid: CUSTOMER_UID,
        slug: 'gas-nueva',
        distributor: distributorDoc('gas-nueva', distributorChange),
        ...(member
          ? { member: memberDoc(newDistributorId('Copies'), CUSTOMER_UID, 'owner', member) }
          : {}),
      });

    it('accepts a new distributor without a weight, or with a null one', async () => {
      await assertSucceeds(found({ priceFromWeightKg: null }));
    });

    it('rejects a new distributor that already claims a weight', async () => {
      await assertFails(found({ priceFromWeightKg: 10 }));
    });

    it('accepts a new distributor that links its complaints book from the start', async () => {
      await assertSucceeds(found({ complaintsBookUrl: BOOK }));
    });

    it('rejects a founder whose member carries a name nobody can read', async () => {
      await assertFails(found({}, { displayName: '\u200b' }));
    });
  });
});

// ========================================================== the link to the complaints book ====
describe('public profile — the link to the complaints book', () => {
  it('lets the owner add it without sending the listing back to review', async () => {
    await assertSucceeds(editProfile('owner-a', { complaintsBookUrl: BOOK }));

    const stored = await storedProfile(A);
    expect(stored).toMatchObject({ complaintsBookUrl: BOOK, acceptingOrders: true });
    // Still public: visitors read it on /d/{slug}.
    await assertSucceeds(getDoc(profileOf(anonymous(env))));
  });

  it('lets the owner remove it, as null or by deleting the field', async () => {
    await assertSucceeds(editProfile('owner-a', { complaintsBookUrl: BOOK }));
    await assertSucceeds(editProfile('owner-a', { complaintsBookUrl: null }));
    await assertSucceeds(editProfile('owner-a', { complaintsBookUrl: BOOK }));
    await assertSucceeds(editProfile('owner-a', { complaintsBookUrl: deleteField() }));
  });

  it('accepts the longest link', async () => {
    const longest = `https://example.com/${'a'.repeat(COMPLAINTS_BOOK_URL_MAX_LENGTH - 20)}`;
    await assertSucceeds(editProfile('owner-a', { complaintsBookUrl: longest }));
  });

  it.each([
    ['plain http', 'http://example.com/libro'],
    ['a script', 'javascript:alert(1)'],
    ['no scheme', 'example.com/libro'],
    ['a host without a dot', 'https://localhost/libro'],
    ['a host in capitals', 'https://Example.com/libro'],
    ['credentials', 'https://user@example.com/libro'],
    ['a port', 'https://example.com:8443/libro'],
    ['a space', 'https://example.com/libro de reclamos'],
    ['a quote', 'https://example.com/"libro"'],
    ['an angle bracket', 'https://example.com/<libro>'],
    ['an invisible character', 'https://example.com/\u200blibro'],
    ['a line break', 'https://example.com/\nlibro'],
    ['an empty text', ''],
    ['a number', 42],
    [
      'one character too many',
      `https://example.com/${'a'.repeat(COMPLAINTS_BOOK_URL_MAX_LENGTH - 19)}`,
    ],
  ])('rejects a link with %s', async (_case, url) => {
    await assertFails(editProfile('owner-a', { complaintsBookUrl: url }));
  });

  it.each([
    ['the dispatcher', 'dispatcher-a', A],
    ['a driver', 'driver-a', A],
    ['the owner of B', 'owner-b', A],
    ['a customer', CUSTOMER_UID, A],
    ['the owner of a suspended distributor', 'owner-suspended', WORLD.suspended.d],
    ['the owner of a distributor whose trial ended', 'owner-expired', WORLD.expired.d],
  ])('rejects %s writing it', async (_who, uid, d) => {
    await assertFails(editProfile(uid, { complaintsBookUrl: BOOK }, d));
  });

  it('rejects the dispatcher adding it next to a real change of the catalogue copies', async () => {
    await assertFails(
      editProfile('dispatcher-a', { priceFromCents: 3900, complaintsBookUrl: BOOK }),
    );
  });

  it('lets the owner of B add one to its own profile', async () => {
    await assertSucceeds(editProfile('owner-b', { complaintsBookUrl: BOOK }, B));
  });
});

/** The public profile as stored, read with the rules out of the way. */
async function storedProfile(d: string): Promise<Record<string, unknown>> {
  let data: Record<string, unknown> = {};
  await env.withSecurityRulesDisabled(async (context) => {
    data = (await getDoc(doc(context.firestore(), `distributors/${d}`))).data() ?? {};
  });
  return data;
}
