// PLAN 3.2 — invitations of staff. There is no server to send an e-mail: an owner shares a link
// whose code is the only secret. These tests prove who may create, read, list, use and revoke
// one, that it works once and within its days, that it cannot be found without its link, and
// that nobody joins a distributor any other way.
import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  collectionGroup,
  deleteDoc,
  deleteField,
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
import {
  INVITE_TTL_DAYS,
  INVITES_QUERY_LIMIT,
  INVITES_QUERY_MAX,
} from '../../src/domain/staff/constants';
import {
  ADMIN_UID,
  anonymous,
  createEnv,
  CUSTOMER_UID,
  type Db,
  editIdentity,
  INVITE_CODE,
  inviteDoc,
  invitePath,
  joinWith,
  memberDoc,
  OTHER_INVITE_CODE,
  PROFILE_NAME,
  revokeInvite,
  seedDoc,
  seedInvite,
  seedProfile,
  seedWorld,
  signedInAnonymously,
  unverified,
  verified,
  verifiedThrough,
  WORLD,
} from './helpers';

let env: RulesTestEnvironment;
const A = WORLD.a.d;
const B = WORLD.b.d;
const DAY_MS = 24 * 60 * 60 * 1000;
const PAST = Timestamp.fromDate(new Date('2026-02-01T12:00:00Z'));
const NEWBIE = CUSTOMER_UID;
const memberPath = (d: string, uid: string) => `distributors/${d}/members/${uid}`;
const inviteOf = (db: Db, d: string, code = INVITE_CODE) => doc(db, invitePath(d, code));
const ownerA = () => verified(env, 'owner-a');

/** What an invitation receives when `uid` uses it. */
const accepted = (uid: string) => ({
  status: 'accepted',
  acceptedBy: uid,
  acceptedAt: serverTimestamp(),
  email: null,
  updatedAt: serverTimestamp(),
});

async function storedInvite(d: string, code = INVITE_CODE) {
  let data: Record<string, unknown> | undefined;
  await env.withSecurityRulesDisabled(async (context) => {
    data = (await getDoc(doc(context.firestore(), invitePath(d, code)))).data();
  });
  return data;
}

async function storedMember(d: string, uid: string) {
  let data: Record<string, unknown> | undefined;
  await env.withSecurityRulesDisabled(async (context) => {
    data = (await getDoc(doc(context.firestore(), memberPath(d, uid)))).data();
  });
  return data;
}

beforeAll(async () => {
  env = await createEnv('invites');
});

beforeEach(async () => {
  await env.clearFirestore();
  await seedWorld(env);
});

afterAll(async () => {
  await env.cleanup();
});

describe('invitations — creating one', () => {
  it.each(['driver', 'dispatcher'])('lets the owner invite a %s by link', async (role) => {
    await assertSucceeds(setDoc(inviteOf(ownerA(), A), inviteDoc({ role })));
  });

  it('lets the owner tie an invitation to a Google address', async () => {
    const tied = inviteDoc({ email: 'c.persona@example.com' });
    await assertSucceeds(setDoc(inviteOf(ownerA(), A), tied));
  });

  it('lets the founder invite another owner, tied to that account', async () => {
    const owner = inviteDoc({ role: 'owner', email: 'socia@example.com' });
    await assertSucceeds(setDoc(inviteOf(ownerA(), A), owner));
  });

  it('blocks the founder from inviting an owner that any account could use', async () => {
    await assertFails(setDoc(inviteOf(ownerA(), A), inviteDoc({ role: 'owner' })));
  });

  it('blocks a co-owner from inviting an owner: only the founder makes owners', async () => {
    await seedDoc(
      env,
      memberPath(A, 'co-owner'),
      memberDoc(A, 'co-owner', 'owner', { createdAt: PAST, updatedAt: PAST }),
    );
    const db = verified(env, 'co-owner');
    const owner = inviteDoc({ role: 'owner', email: 'socia@example.com', createdBy: 'co-owner' });

    await assertFails(setDoc(inviteOf(db, A), owner));
    await assertSucceeds(
      setDoc(inviteOf(db, A, OTHER_INVITE_CODE), inviteDoc({ createdBy: 'co-owner' })),
    );
  });

  it.each([
    ['an anonymous visitor', () => anonymous(env), 'owner-a'],
    ['a customer', () => verified(env, CUSTOMER_UID), CUSTOMER_UID],
    ['its dispatcher', () => verified(env, 'dispatcher-a'), 'dispatcher-a'],
    ['its driver', () => verified(env, 'driver-a'), 'driver-a'],
    ['the owner of another distributor', () => verified(env, 'owner-b'), 'owner-b'],
    ['a platform admin', () => verified(env, ADMIN_UID), ADMIN_UID],
  ])('blocks %s from creating one', async (_who, connect, uid) => {
    await assertFails(setDoc(inviteOf(connect(), A), inviteDoc({ createdBy: uid })));
  });

  it('blocks an owner of A from creating one in B (aislamiento A/B)', async () => {
    await assertFails(setDoc(inviteOf(ownerA(), B), inviteDoc()));
  });

  it.each([
    ['suspended', WORLD.suspended, 'owner-suspended'],
    ['on an expired trial', WORLD.expired, 'owner-expired'],
    ['past due', WORLD.pastDue, 'owner-past-due'],
  ] as const)('blocks inviting into a distributor that is %s', async (_case, seeded, owner) => {
    const db = verified(env, owner);
    await assertFails(setDoc(inviteOf(db, seeded.d), inviteDoc({ createdBy: owner })));
  });

  it('lets the owner of a listing that waits for its review invite its staff', async () => {
    const db = verified(env, 'owner-pending');
    const invite = inviteDoc({ createdBy: 'owner-pending' });
    await assertSucceeds(setDoc(inviteOf(db, WORLD.pending.d), invite));
  });

  it.each([
    ['a short code', 'Invite0001'],
    ['a code of 21 characters', `${INVITE_CODE}X`],
    ['a code with a hyphen', 'Invite-000000000000A'],
    ['a word anyone could guess', 'repartidor0000000000'.replace(/0/g, '-')],
  ])('blocks an invitation under %s', async (_case, code) => {
    await assertFails(setDoc(doc(ownerA(), invitePath(A, code)), inviteDoc()));
  });

  it.each([
    ['an unknown role', { role: 'admin' }],
    ['an address in capitals', { email: 'C.Persona@example.com' }],
    ['an address without an @', { email: 'c.persona.example.com' }],
    ['an address with a space', { email: 'c persona@example.com' }],
    ['an address that is not text', { email: 7 }],
    ['an oversized address', { email: `${'a'.repeat(250)}@example.com` }],
    ['another distributor name', { distributorName: 'Otra Distribuidora' }],
    ['another author', { createdBy: 'dispatcher-a' }],
    ['a used status', { status: 'accepted' }],
    ['a revoked status', { status: 'revoked' }],
    ['who used it', { acceptedBy: CUSTOMER_UID }],
    ['a made-up creation date', { createdAt: Timestamp.fromMillis(Date.now() + 30 * DAY_MS) }],
    ['a date in the past', { createdAt: PAST, updatedAt: PAST }],
    ['an extra field', { expiresAt: Timestamp.fromMillis(Date.now() + 365 * DAY_MS) }],
  ])('blocks an invitation with %s', async (_case, change) => {
    await assertFails(setDoc(inviteOf(ownerA(), A), inviteDoc(change)));
  });

  it('blocks an invitation without the name of the distributor', async () => {
    const { distributorName: _left, ...rest } = inviteDoc();
    await assertFails(setDoc(inviteOf(ownerA(), A), rest));
  });

  it('blocks replacing an invitation that exists: that is an update', async () => {
    await seedInvite(env, A, INVITE_CODE);
    await assertFails(setDoc(inviteOf(ownerA(), A), inviteDoc({ role: 'dispatcher' })));
  });
});

describe('invitations — reading one needs its link', () => {
  beforeEach(async () => {
    await seedInvite(env, A, INVITE_CODE);
  });

  it.each([
    ['a customer', CUSTOMER_UID],
    ['the owner of another distributor', 'owner-b'],
    ['a driver of A', 'driver-a'],
  ])('lets %s with the code read it', async (_who, uid) => {
    const read = await assertSucceeds(getDoc(inviteOf(verified(env, uid), A)));
    expect(read.get('role')).toBe('driver');
  });

  // PLAN §11 (2026-10-16): refused like one tied to another account, so a refusal tells the
  // holder of a link nothing about which of the two it is.
  it('refuses a code nobody created, like one tied to another account', async () => {
    await assertFails(getDoc(inviteOf(verified(env, NEWBIE), A, OTHER_INVITE_CODE)));
  });

  it.each([
    ['an anonymous visitor', () => anonymous(env)],
    ['a password session', () => verifiedThrough(env, NEWBIE, 'password')],
    ['an anonymous session', () => signedInAnonymously(env, NEWBIE)],
    ['a Google session without a verified e-mail', () => unverified(env, NEWBIE)],
  ])('blocks %s from reading it', async (_who, connect) => {
    await assertFails(getDoc(inviteOf(connect(), A)));
  });
});

// PLAN §11 (2026-10-16): the address an owner typed is data of somebody else.
describe('invitations — one tied to an address is read only by that account', () => {
  const TIED = { email: `${NEWBIE}@example.com` };

  beforeEach(async () => {
    await seedInvite(env, A, OTHER_INVITE_CODE, TIED);
  });

  it.each([
    ['the account it is tied to', () => verified(env, NEWBIE)],
    ['its owner', () => ownerA()],
  ])('lets %s read it', async (_who, connect) => {
    await assertSucceeds(getDoc(inviteOf(connect(), A, OTHER_INVITE_CODE)));
  });

  it('compares the address of the session in lowercase', async () => {
    const db = env
      .authenticatedContext(NEWBIE, {
        email: `${NEWBIE.toUpperCase()}@Example.com`,
        email_verified: true,
        firebase: { sign_in_provider: 'google.com', identities: {} },
      } as never)
      .firestore();
    await assertSucceeds(getDoc(inviteOf(db, A, OTHER_INVITE_CODE)));
  });

  it.each([
    ['another account with the link', 'second'],
    ['its dispatcher', 'dispatcher-a'],
    ['its driver', 'driver-a'],
    ['the owner of another distributor', 'owner-b'],
  ])('blocks %s from reading it', async (_who, uid) => {
    await assertFails(getDoc(inviteOf(verified(env, uid), A, OTHER_INVITE_CODE)));
  });

  it('lets anyone with the link read it once used: the address is gone', async () => {
    await assertSucceeds(
      joinWith(verified(env, NEWBIE), { d: A, code: OTHER_INVITE_CODE, uid: NEWBIE }),
    );

    expect(await storedInvite(A, OTHER_INVITE_CODE)).toMatchObject({ email: null });
    await assertSucceeds(getDoc(inviteOf(verified(env, 'second'), A, OTHER_INVITE_CODE)));
  });

  it.each([
    ['keeping the address', { email: TIED.email }],
    ['writing another address', { email: 'otra@example.com' }],
  ])('blocks using it %s', async (_case, invite) => {
    const db = verified(env, NEWBIE);
    await assertFails(joinWith(db, { d: A, code: OTHER_INVITE_CODE, uid: NEWBIE, invite }));
  });

  it('blocks an owner from clearing the address of one that waits', async () => {
    await assertFails(
      updateDoc(inviteOf(ownerA(), A, OTHER_INVITE_CODE), {
        email: null,
        updatedAt: serverTimestamp(),
      }),
    );
  });
});

describe('invitations — nobody finds one without its link', () => {
  beforeEach(async () => {
    await seedInvite(env, A, INVITE_CODE);
  });

  const invitesOf = (db: Db, d = A) => collection(db, `distributors/${d}/invites`);

  it('lets the owner list them, bounded', async () => {
    const pending = query(
      invitesOf(ownerA()),
      where('status', '==', 'pending'),
      limit(INVITES_QUERY_LIMIT),
    );
    const found = await assertSucceeds(getDocs(pending));
    expect(found.size).toBe(1);
  });

  it('blocks the owner from an unbounded or oversized list', async () => {
    await assertFails(getDocs(invitesOf(ownerA())));
    await assertFails(getDocs(query(invitesOf(ownerA()), limit(INVITES_QUERY_MAX + 1))));
  });

  it.each([
    ['a customer', CUSTOMER_UID],
    ['its dispatcher', 'dispatcher-a'],
    ['its driver', 'driver-a'],
    ['the owner of another distributor', 'owner-b'],
    ['a platform admin', ADMIN_UID],
  ])('blocks %s from listing them', async (_who, uid) => {
    await assertFails(getDocs(query(invitesOf(verified(env, uid)), limit(1))));
  });

  it('blocks a search of invitations across distributors', async () => {
    for (const uid of [CUSTOMER_UID, 'owner-a', ADMIN_UID]) {
      const everywhere = query(collectionGroup(verified(env, uid), 'invites'), limit(1));
      await assertFails(getDocs(everywhere));
    }
  });

  it('blocks an owner of B from listing the invitations of A (aislamiento A/B)', async () => {
    await assertFails(getDocs(query(invitesOf(verified(env, 'owner-b'), A), limit(5))));
  });
});

describe('invitations — using one', () => {
  beforeEach(async () => {
    await seedInvite(env, A, INVITE_CODE);
  });

  it('lets an account with a profile join with the role of the invitation', async () => {
    await assertSucceeds(joinWith(verified(env, NEWBIE), { d: A, code: INVITE_CODE, uid: NEWBIE }));

    expect(await storedMember(A, NEWBIE)).toMatchObject({
      role: 'driver',
      active: true,
      inviteId: INVITE_CODE,
    });
    expect(await storedInvite(A)).toMatchObject({ status: 'accepted', acceptedBy: NEWBIE });
  });

  it('gives the new member access to what its role reads', async () => {
    await joinWith(verified(env, NEWBIE), { d: A, code: INVITE_CODE, uid: NEWBIE });

    await assertSucceeds(getDoc(doc(verified(env, NEWBIE), `distributors/${A}/private/control`)));
  });

  it('lets a dispatcher join through an invitation for a dispatcher', async () => {
    await seedInvite(env, A, OTHER_INVITE_CODE, { role: 'dispatcher' });
    const join = { d: A, code: OTHER_INVITE_CODE, uid: NEWBIE, role: 'dispatcher' as const };
    await assertSucceeds(joinWith(verified(env, NEWBIE), join));
  });

  it('lets the named account use an invitation tied to its address', async () => {
    await seedInvite(env, A, OTHER_INVITE_CODE, { email: `${NEWBIE}@example.com` });
    await assertSucceeds(
      joinWith(verified(env, NEWBIE), { d: A, code: OTHER_INVITE_CODE, uid: NEWBIE }),
    );
  });

  it("lets the named account join as owner through the founder's invitation", async () => {
    await seedInvite(env, A, OTHER_INVITE_CODE, { role: 'owner', email: `${NEWBIE}@example.com` });
    const join = { d: A, code: OTHER_INVITE_CODE, uid: NEWBIE, role: 'owner' as const };
    await assertSucceeds(joinWith(verified(env, NEWBIE), join));
  });

  it('blocks another account from an invitation tied to an address', async () => {
    await seedInvite(env, A, OTHER_INVITE_CODE, { role: 'owner', email: 'socia@example.com' });
    const join = { d: A, code: OTHER_INVITE_CODE, uid: NEWBIE, role: 'owner' as const };
    await assertFails(joinWith(verified(env, NEWBIE), join));
  });

  it('blocks an invitation once its days are over', async () => {
    await seedInvite(env, A, OTHER_INVITE_CODE, {}, INVITE_TTL_DAYS * DAY_MS + 60_000);
    await assertFails(
      joinWith(verified(env, NEWBIE), { d: A, code: OTHER_INVITE_CODE, uid: NEWBIE }),
    );
  });

  it('still takes an invitation in its last minute', async () => {
    await seedInvite(env, A, OTHER_INVITE_CODE, {}, INVITE_TTL_DAYS * DAY_MS - 60_000);
    await assertSucceeds(
      joinWith(verified(env, NEWBIE), { d: A, code: OTHER_INVITE_CODE, uid: NEWBIE }),
    );
  });

  it('works once: a second account cannot use it afterwards', async () => {
    await joinWith(verified(env, NEWBIE), { d: A, code: INVITE_CODE, uid: NEWBIE });
    await seedProfile(env, 'second');

    await assertFails(
      joinWith(verified(env, 'second'), { d: A, code: INVITE_CODE, uid: 'second' }),
    );
  });

  it('lets exactly one of two accounts win when both use the same code at once', async () => {
    await seedProfile(env, 'second');

    const results = await Promise.allSettled([
      joinWith(verified(env, NEWBIE), { d: A, code: INVITE_CODE, uid: NEWBIE }),
      joinWith(verified(env, 'second'), { d: A, code: INVITE_CODE, uid: 'second' }),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const winner = (await storedInvite(A))?.acceptedBy as string;
    expect(await storedMember(A, winner)).toBeDefined();
    const loser = winner === NEWBIE ? 'second' : NEWBIE;
    expect(await storedMember(A, loser)).toBeUndefined();
  });

  it('blocks a revoked invitation', async () => {
    await revokeInvite(ownerA(), A, INVITE_CODE, 'owner-a');
    await assertFails(joinWith(verified(env, NEWBIE), { d: A, code: INVITE_CODE, uid: NEWBIE }));
  });

  it('blocks using an invitation of A to join B (aislamiento A/B)', async () => {
    const db = verified(env, NEWBIE);
    const batch = writeBatch(db);
    const intoB = memberDoc(B, NEWBIE, 'driver', {
      displayName: PROFILE_NAME,
      inviteId: INVITE_CODE,
    });
    batch.set(doc(db, memberPath(B, NEWBIE)), intoB);
    batch.update(inviteOf(db, A), accepted(NEWBIE));

    await assertFails(batch.commit());
    await assertFails(joinWith(db, { d: B, code: INVITE_CODE, uid: NEWBIE }));
  });

  it.each([
    ['a higher role than the invitation', { role: 'owner' }],
    ['another role than the invitation', { role: 'dispatcher' }],
    ['a name other than its profile', { displayName: 'Otro Nombre' }],
    ['another code', { inviteId: OTHER_INVITE_CODE }],
    ['a code of another shape', { inviteId: 'token-1' }],
    ['switched off', { active: false }],
    ['another name of the distributor', { distributorName: 'Otra' }],
    ['a made-up date', { createdAt: PAST }],
    ['an extra field', { salary: 1000 }],
  ])('blocks a member created with %s', async (_case, member) => {
    const db = verified(env, NEWBIE);
    await assertFails(joinWith(db, { d: A, code: INVITE_CODE, uid: NEWBIE, member }));
  });

  it('blocks a member that does not name the invitation it used', async () => {
    const db = verified(env, NEWBIE);
    const batch = writeBatch(db);
    batch.set(
      doc(db, memberPath(A, NEWBIE)),
      memberDoc(A, NEWBIE, 'driver', { displayName: PROFILE_NAME }),
    );
    batch.update(inviteOf(db, A), accepted(NEWBIE));

    await assertFails(batch.commit());
  });

  it('blocks creating the member without marking the invitation used', async () => {
    await assertFails(
      joinWith(verified(env, NEWBIE), { d: A, code: INVITE_CODE, uid: NEWBIE, invite: null }),
    );
  });

  it('blocks marking the invitation used without creating the member', async () => {
    await assertFails(
      joinWith(verified(env, NEWBIE), { d: A, code: INVITE_CODE, uid: NEWBIE, member: null }),
    );
  });

  it.each([
    ['in the name of another account', { acceptedBy: 'owner-b' }],
    ['with a made-up date', { acceptedAt: PAST }],
    ['as revoked instead', { status: 'revoked' }],
    ['changing its role on the way', { role: 'owner' }],
    ['resetting its creation date', { createdAt: serverTimestamp() }],
  ])('blocks marking it used %s', async (_case, invite) => {
    await assertFails(
      joinWith(verified(env, NEWBIE), { d: A, code: INVITE_CODE, uid: NEWBIE, invite }),
    );
  });

  it('blocks creating a member for someone else with the code', async () => {
    const db = verified(env, NEWBIE);
    await assertFails(joinWith(db, { d: A, code: INVITE_CODE, uid: 'someone-else' }));
  });

  it('compares the address of the session in lowercase, as Google may write it otherwise', async () => {
    await seedInvite(env, A, OTHER_INVITE_CODE, { email: 'c.persona@example.com' });
    const db = env
      .authenticatedContext(NEWBIE, {
        email: 'C.Persona@Example.com',
        email_verified: true,
        firebase: { sign_in_provider: 'google.com', identities: {} },
      } as never)
      .firestore();

    await assertSucceeds(joinWith(db, { d: A, code: OTHER_INVITE_CODE, uid: NEWBIE }));
  });

  it('blocks joining through a document whose id is not a code', async () => {
    await seedDoc(env, invitePath(A, 'token-1'), inviteDoc({ createdAt: Timestamp.now() }));
    const db = verified(env, NEWBIE);

    await assertFails(joinWith(db, { d: A, code: 'token-1', uid: NEWBIE }));
  });

  it('blocks using it without a fresh date on the invitation', async () => {
    const db = verified(env, NEWBIE);
    const invite = { updatedAt: Timestamp.fromMillis(Date.now() - DAY_MS) };

    await assertFails(joinWith(db, { d: A, code: INVITE_CODE, uid: NEWBIE, invite }));
  });

  it('blocks an account without a profile: nothing is stored before the terms', async () => {
    const db = verified(env, 'no-profile');
    await assertFails(joinWith(db, { d: A, code: INVITE_CODE, uid: 'no-profile' }));
  });

  it.each([
    ['a password session', () => verifiedThrough(env, NEWBIE, 'password')],
    ['an anonymous session', () => signedInAnonymously(env, NEWBIE)],
    ['a Google session without a verified e-mail', () => unverified(env, NEWBIE)],
  ])('blocks %s from using it', async (_who, connect) => {
    await assertFails(joinWith(connect(), { d: A, code: INVITE_CODE, uid: NEWBIE }));
  });

  it('blocks a member of A from joining A again with another role', async () => {
    const db = verified(env, 'driver-a');
    await assertFails(joinWith(db, { d: A, code: INVITE_CODE, uid: 'driver-a' }));
  });

  it('blocks a member that was switched off from coming back by an invitation', async () => {
    await seedDoc(
      env,
      memberPath(A, NEWBIE),
      memberDoc(A, NEWBIE, 'driver', {
        active: false,
        displayName: PROFILE_NAME,
        createdAt: PAST,
        updatedAt: PAST,
      }),
    );
    await assertFails(joinWith(verified(env, NEWBIE), { d: A, code: INVITE_CODE, uid: NEWBIE }));
  });

  // Each invitation is created by the owner of that distributor, so only its state refuses it.
  it.each([
    ['suspended', WORLD.suspended, 'owner-suspended'],
    ['on an expired trial', WORLD.expired, 'owner-expired'],
  ] as const)('blocks joining a distributor that is %s', async (_case, seeded, owner) => {
    await seedInvite(env, seeded.d, INVITE_CODE, { createdBy: owner });
    const db = verified(env, NEWBIE);
    await assertFails(joinWith(db, { d: seeded.d, code: INVITE_CODE, uid: NEWBIE }));
  });
});

// PLAN §11 (2026-10-16): an invitation speaks for the owner who created it. It stops working
// when that person stops being an active owner — switched off, demoted, account deleted — and
// one for an owner works only while its author is the founder.
describe('invitations — only while who created it is an active owner', () => {
  const CO_OWNER = 'co-owner';
  const ownerInvite = { role: 'owner', email: `${NEWBIE}@example.com` };

  async function seedCoOwner(change: Record<string, unknown> = {}) {
    const member = memberDoc(A, CO_OWNER, 'owner', { createdAt: PAST, updatedAt: PAST, ...change });
    await seedDoc(env, memberPath(A, CO_OWNER), member);
  }

  const joinNewbie = (role: 'driver' | 'owner' = 'driver') =>
    joinWith(verified(env, NEWBIE), { d: A, code: INVITE_CODE, uid: NEWBIE, role });

  it('lets in through the invitation of an active co-owner', async () => {
    await seedCoOwner();
    await seedInvite(env, A, INVITE_CODE, { createdBy: CO_OWNER });

    await assertSucceeds(joinNewbie());
  });

  it("lets in as owner through the founder's invitation", async () => {
    await seedInvite(env, A, INVITE_CODE, ownerInvite);
    await assertSucceeds(joinNewbie('owner'));
  });

  it.each([
    ['switched off', { active: false }],
    ['demoted to dispatcher', { role: 'dispatcher' }],
    ['demoted to driver', { role: 'driver' }],
  ])('blocks the invitation of a co-owner who was %s', async (_case, change) => {
    await seedCoOwner(change);
    await seedInvite(env, A, INVITE_CODE, { createdBy: CO_OWNER });

    await assertFails(joinNewbie());
  });

  it('blocks the invitation of an account that is no longer staff (its member is gone)', async () => {
    await seedInvite(env, A, INVITE_CODE, { createdBy: 'deleted-account' });
    await assertFails(joinNewbie());
  });

  it('blocks the invitation of the owner of another distributor (aislamiento A/B)', async () => {
    await seedInvite(env, A, INVITE_CODE, { createdBy: 'owner-b' });
    await assertFails(joinNewbie());
  });

  it('blocks an invitation to an owner created by a co-owner, active as it is', async () => {
    await seedCoOwner();
    await seedInvite(env, A, INVITE_CODE, { ...ownerInvite, createdBy: CO_OWNER });

    await assertFails(joinNewbie('owner'));
  });

  it('lets the founder revoke the invitation of a co-owner switched off', async () => {
    await seedCoOwner({ active: false });
    await seedInvite(env, A, INVITE_CODE, { createdBy: CO_OWNER });

    await assertSucceeds(revokeInvite(ownerA(), A, INVITE_CODE, 'owner-a'));
  });
});

describe('invitations — revoking one', () => {
  beforeEach(async () => {
    await seedInvite(env, A, INVITE_CODE);
  });

  it('lets the owner revoke a pending invitation, which then cannot be used', async () => {
    await assertSucceeds(revokeInvite(ownerA(), A, INVITE_CODE, 'owner-a'));

    expect(await storedInvite(A)).toMatchObject({ status: 'revoked', revokedBy: 'owner-a' });
  });

  it('lets the owner of a suspended distributor revoke: it only takes access away', async () => {
    const d = WORLD.suspended.d;
    await seedInvite(env, d, INVITE_CODE, { createdBy: 'owner-suspended' });
    await assertSucceeds(
      revokeInvite(verified(env, 'owner-suspended'), d, INVITE_CODE, 'owner-suspended'),
    );
  });

  it.each([
    ['its dispatcher', 'dispatcher-a'],
    ['its driver', 'driver-a'],
    ['a customer holding the link', CUSTOMER_UID],
    ['the owner of another distributor', 'owner-b'],
    ['a platform admin', ADMIN_UID],
  ])('blocks %s from revoking it', async (_who, uid) => {
    await assertFails(revokeInvite(verified(env, uid), A, INVITE_CODE, uid));
  });

  it('blocks revoking in the name of another owner', async () => {
    await assertFails(revokeInvite(ownerA(), A, INVITE_CODE, 'owner-b'));
  });

  it('blocks reviving or re-revoking an invitation that was revoked', async () => {
    await revokeInvite(ownerA(), A, INVITE_CODE, 'owner-a');
    const invite = inviteOf(ownerA(), A);

    await assertFails(updateDoc(invite, { status: 'pending', updatedAt: serverTimestamp() }));
    await assertFails(revokeInvite(ownerA(), A, INVITE_CODE, 'owner-a'));
  });

  it('blocks revoking an invitation that was already used', async () => {
    await joinWith(verified(env, NEWBIE), { d: A, code: INVITE_CODE, uid: NEWBIE });
    await assertFails(revokeInvite(ownerA(), A, INVITE_CODE, 'owner-a'));
  });

  it.each([
    ['its role', { role: 'dispatcher' }],
    ['its address', { email: 'otra@example.com' }],
    ['its creation date, to give it new days', { createdAt: serverTimestamp() }],
  ])('blocks the owner from changing %s', async (_case, change) => {
    await assertFails(
      updateDoc(inviteOf(ownerA(), A), { ...change, updatedAt: serverTimestamp() }),
    );
  });

  it.each([
    ['its role', { role: 'dispatcher' }],
    ['its creation date, to give it new days', { createdAt: serverTimestamp() }],
  ])('blocks the owner from changing %s while revoking it', async (_case, change) => {
    const revoke = {
      status: 'revoked',
      revokedBy: 'owner-a',
      revokedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await assertFails(updateDoc(inviteOf(ownerA(), A), { ...revoke, ...change }));
  });

  it.each(['accepted', 'pending'])(
    'blocks the owner from leaving it %s through a revocation',
    async (status) => {
      const signed = { revokedBy: 'owner-a', revokedAt: serverTimestamp() };
      await assertFails(
        updateDoc(inviteOf(ownerA(), A), { status, ...signed, updatedAt: serverTimestamp() }),
      );
    },
  );

  it('blocks revoking without a fresh date', async () => {
    const stale = Timestamp.fromMillis(Date.now() - DAY_MS);
    const revoke = { status: 'revoked', revokedBy: 'owner-a', revokedAt: serverTimestamp() };
    await assertFails(updateDoc(inviteOf(ownerA(), A), { ...revoke, updatedAt: stale }));
  });

  it('blocks deleting an invitation, also for its owner', async () => {
    await assertFails(deleteDoc(inviteOf(ownerA(), A)));
    await assertFails(deleteDoc(inviteOf(verified(env, ADMIN_UID), A)));
  });
});

// The invitation keeps a copy of the public name: whoever joins writes it into its member, whose
// rule wants the public name. Renaming the distributor brings the copies of the invitations that
// wait up to date, in the same batch.
describe('invitations — the copy of the distributor name', () => {
  const NEW_NAME = 'Gas Demo Renovado';

  beforeEach(async () => {
    await seedInvite(env, A, INVITE_CODE);
  });

  function renameWithInvite(db: Db, name: string, inviteName = name): Promise<void> {
    const batch = writeBatch(db);
    batch.update(doc(db, `distributors/${A}`), {
      name,
      acceptingOrders: false,
      updatedAt: serverTimestamp(),
    });
    batch.update(doc(db, `distributors/${A}/private/control`), {
      listingApproved: false,
      approvedAt: deleteField(),
      approvedBy: deleteField(),
      reviewedProfileAt: deleteField(),
      reviewedSettingsAt: deleteField(),
      distributorName: name,
      updatedAt: serverTimestamp(),
    });
    batch.update(inviteOf(db, A), { distributorName: inviteName, updatedAt: serverTimestamp() });
    return batch.commit();
  }

  it('lets the owner bring a waiting invitation up to date with a new name', async () => {
    await assertSucceeds(renameWithInvite(ownerA(), NEW_NAME));

    expect(await storedInvite(A)).toMatchObject({ distributorName: NEW_NAME, status: 'pending' });
  });

  it('lets the new member join with the new name afterwards', async () => {
    await renameWithInvite(ownerA(), NEW_NAME);
    const member = { distributorName: NEW_NAME };

    await assertSucceeds(
      joinWith(verified(env, NEWBIE), { d: A, code: INVITE_CODE, uid: NEWBIE, member }),
    );
  });

  it('blocks an invitation whose copy is older than the name from being used', async () => {
    await editIdentity(ownerA(), A, { name: NEW_NAME });

    await assertFails(joinWith(verified(env, NEWBIE), { d: A, code: INVITE_CODE, uid: NEWBIE }));
  });

  it('blocks writing a name that is not the public one', async () => {
    await assertFails(renameWithInvite(ownerA(), NEW_NAME, 'Otro Nombre'));
    await assertFails(
      updateDoc(inviteOf(ownerA(), A), { distributorName: 'Otro Nombre', ...stampNow() }),
    );
  });

  it.each([
    ['its dispatcher', 'dispatcher-a'],
    ['the customer holding the link', CUSTOMER_UID],
    ['the owner of another distributor', 'owner-b'],
  ])('blocks %s from rewriting the copy', async (_who, uid) => {
    const db = verified(env, uid);
    await assertFails(updateDoc(inviteOf(db, A), { distributorName: 'Gas Demo', ...stampNow() }));
  });

  it.each([
    ['marks it used', { status: 'accepted' }],
    ['changes its role', { role: 'owner' }],
    ['gives it new days', { createdAt: serverTimestamp() }],
  ])('blocks a rewrite of the copy that also %s', async (_case, change) => {
    const refresh = { distributorName: 'Gas Demo', ...change, ...stampNow() };
    await assertFails(updateDoc(inviteOf(ownerA(), A), refresh));
  });

  it('blocks rewriting the copy of an invitation that was used or revoked', async () => {
    await seedInvite(env, A, OTHER_INVITE_CODE, { status: 'revoked' });
    await joinWith(verified(env, NEWBIE), { d: A, code: INVITE_CODE, uid: NEWBIE });

    for (const code of [INVITE_CODE, OTHER_INVITE_CODE]) {
      const invite = inviteOf(ownerA(), A, code);
      await assertFails(updateDoc(invite, { distributorName: 'Gas Demo', ...stampNow() }));
    }
  });
});

function stampNow() {
  return { updatedAt: serverTimestamp() };
}
