// PLAN 3.2 — rules-breaker, 2026-10-15. A modified client with the SDK against invitations,
// staff management, helpers, the platform note and the dispatcher's copy of the catalogue in
// the public profile. Every case is "rejects X" unless it pins the exact reach of a risk the plan
// accepts (PLAN §9). The one hole it found (names nobody can read) is closed (PLAN §11, 2026-10-15).
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
  documentId,
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
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { INVITE_TTL_DAYS } from '../../src/domain/staff/constants';
import {
  ADMIN_UID,
  anonymous,
  createEnv,
  CUSTOMER_UID,
  type Db,
  DISTRIBUTOR_NAME,
  helperDoc,
  helperPath,
  INVITE_CODE,
  inviteDoc,
  invitePath,
  joinWith,
  leaveNote,
  memberDoc,
  OTHER_INVITE_CODE,
  PROFILE_NAME,
  reviewedMarks,
  reviewPath,
  revokeInvite,
  seedDoc,
  seedInvite,
  seedWorld as seedBase,
  signedInAnonymously,
  unverified,
  userDoc,
  verified,
  verifiedThrough,
  WORLD,
} from './helpers';

let env: RulesTestEnvironment;
const A = WORLD.a.d;
const B = WORLD.b.d;
const PENDING = WORLD.pending.d;
const SUSPENDED = WORLD.suspended.d;
const EXPIRED = WORLD.expired.d;
const FOUNDER = 'owner-a';
const CO_OWNER = 'co-owner';
const CO_OWNER_OFF = 'co-owner-off';
const DISPATCHER_OFF = 'dispatcher-off';
const NEWBIE = CUSTOMER_UID;
const DAY_MS = 24 * 60 * 60 * 1000;
const TTL_MS = INVITE_TTL_DAYS * DAY_MS;
const PAST = Timestamp.fromDate(new Date('2026-02-01T12:00:00Z'));
const seeded = { createdAt: PAST, updatedAt: PAST };
const stamp = { updatedAt: serverTimestamp() };
const THIRD_CODE = 'Invite0000000000000C';

const memberPath = (d: string, uid: string) => `distributors/${d}/members/${uid}`;
const memberOf = (db: Db, uid: string, d = A) => doc(db, memberPath(d, uid));
const inviteOf = (db: Db, d = A, code = INVITE_CODE) => doc(db, invitePath(d, code));
const helperOf = (db: Db, slot: string, d = A) => doc(db, helperPath(d, slot));
const profileOf = (db: Db, d: string) => doc(db, `distributors/${d}`);
const controlOf = (db: Db, d: string) => doc(db, `distributors/${d}/private/control`);
const as = (uid: string) => verified(env, uid);

/** A session of Google on `uid` whose token carries exactly `email`. */
function googleWithEmail(uid: string, email: string): Db {
  return env
    .authenticatedContext(uid, {
      email,
      email_verified: true,
      firebase: { sign_in_provider: 'google.com', identities: {} },
    } as never)
    .firestore();
}

/** What an owner's client sends to create an invitation, with one thing changed. */
function createInvite(db: Db, by: string, change: Record<string, unknown> = {}, d = A) {
  return setDoc(doc(db, invitePath(d, THIRD_CODE)), inviteDoc({ createdBy: by, ...change }));
}

beforeAll(async () => {
  env = await createEnv('attack-staff');
});

beforeEach(async () => {
  await env.clearFirestore();
  await seedWorld();
});

afterAll(async () => {
  await env.cleanup();
});

async function seedWorld() {
  await seedBase(env);
  await seedDoc(env, memberPath(A, CO_OWNER), memberDoc(A, CO_OWNER, 'owner', seeded));
  await seedDoc(
    env,
    memberPath(A, CO_OWNER_OFF),
    memberDoc(A, CO_OWNER_OFF, 'owner', { active: false, ...seeded }),
  );
  await seedDoc(
    env,
    memberPath(A, DISPATCHER_OFF),
    memberDoc(A, DISPATCHER_OFF, 'dispatcher', { active: false, ...seeded }),
  );
  for (const uid of [CO_OWNER, CO_OWNER_OFF, DISPATCHER_OFF]) {
    await seedDoc(env, `users/${uid}`, userDoc(seeded));
  }
  await seedInvite(env, A, INVITE_CODE);
}

// =============================================================================== invitations ====
describe('attack: invitations — finding one without its link', () => {
  it.each([
    ['its dispatcher', 'dispatcher-a'],
    ['its driver', 'driver-a'],
    ['a customer', NEWBIE],
    ['the owner of B', 'owner-b'],
    ['a platform admin', ADMIN_UID],
    ['an owner that was switched off', CO_OWNER_OFF],
  ])('rejects %s listing the pending invitations of A', async (_who, uid) => {
    const pending = query(
      collection(as(uid), `distributors/${A}/invites`),
      where('status', '==', 'pending'),
      limit(5),
    );
    await assertFails(getDocs(pending));
  });

  it('rejects looking a code up by its id through a query instead of a get', async () => {
    const byId = query(
      collection(as(NEWBIE), `distributors/${A}/invites`),
      where(documentId(), '==', INVITE_CODE),
      limit(1),
    );
    await assertFails(getDocs(byId));
  });

  it.each([
    ['a customer, by its own address', NEWBIE, where('email', '==', `${NEWBIE}@example.com`)],
    ['the owner of A, by status', FOUNDER, where('status', '==', 'pending')],
    ['a platform admin, by role', ADMIN_UID, where('role', '==', 'owner')],
  ])('rejects %s searching invitations across distributors', async (_who, uid, filter) => {
    await assertFails(getDocs(query(collectionGroup(as(uid), 'invites'), filter, limit(1))));
  });

  it.each([
    ['an anonymous visitor', () => anonymous(env)],
    ['an anonymous session', () => signedInAnonymously(env, NEWBIE)],
    ['a session with a password', () => verifiedThrough(env, NEWBIE, 'password')],
  ])('rejects %s reading an invitation even with its code', async (_who, db) => {
    await assertFails(getDoc(inviteOf(db())));
  });
});

describe('attack: invitations — creating one without the right', () => {
  it.each([
    ['its dispatcher', 'dispatcher-a'],
    ['its driver', 'driver-a'],
    ['a customer', NEWBIE],
    ['a platform admin', ADMIN_UID],
    ['the owner of B', 'owner-b'],
    ['an owner that was switched off', CO_OWNER_OFF],
  ])('rejects %s inviting a driver to A', async (_who, uid) => {
    await assertFails(createInvite(as(uid), uid));
  });

  it.each([
    ['suspended', SUSPENDED, 'owner-suspended'],
    ['with its trial over', EXPIRED, 'owner-expired'],
    ['past due', WORLD.pastDue.d, 'owner-past-due'],
  ])('rejects the owner of a distributor %s inviting anybody', async (_case, d, uid) => {
    await assertFails(createInvite(as(uid), uid, {}, d));
  });

  it('rejects a co-owner inviting an owner, even tied to an address', async () => {
    await assertFails(
      createInvite(as(CO_OWNER), CO_OWNER, { role: 'owner', email: 'socio@example.com' }),
    );
  });

  it('rejects the founder inviting an owner that any account could use', async () => {
    await assertFails(createInvite(as(FOUNDER), FOUNDER, { role: 'owner', email: null }));
  });

  it.each([
    ['in capitals', 'Socio@Example.com'],
    ['with a space before', ' socio@example.com'],
    ['with a space after', 'socio@example.com '],
    ['with a space inside', 'socio @example.com'],
    ['without a domain', 'socio'],
    ['empty', ''],
    ['as a number', 42],
    ['as a list', ['socio@example.com']],
    ['longer than an address can be', `${'a'.repeat(250)}@example.com`],
  ])('rejects tying an invitation to an address %s', async (_case, email) => {
    await assertFails(createInvite(as(FOUNDER), FOUNDER, { email }));
  });

  it.each([
    ['in the name of another owner', { createdBy: CO_OWNER }],
    ['dated in the past', { createdAt: PAST }],
    ['dated in the future', { createdAt: Timestamp.fromMillis(Date.now() + DAY_MS) }],
    ['with an old update date', { updatedAt: PAST }],
    ['already used', { status: 'accepted' }],
    ['already revoked', { status: 'revoked' }],
    ['already used by someone', { acceptedBy: NEWBIE, acceptedAt: serverTimestamp() }],
    ['for a platform role', { role: 'admin' }],
    ['for a role spelled otherwise', { role: 'Owner' }],
    ['with another distributor name', { distributorName: 'Gas Famosa' }],
    ['with a field of its own', { expiresAt: Timestamp.fromMillis(Date.now() + 365 * DAY_MS) }],
  ])('rejects the founder creating an invitation %s', async (_case, change) => {
    await assertFails(createInvite(as(FOUNDER), FOUNDER, change));
  });

  it.each([
    ['too short', 'Invite00000000000A'],
    ['too long', 'Invite00000000000000AB'],
    ['with an underscore', 'Invite000000000000_A'],
    ['with a dash', 'Invite000000000000-A'],
  ])('rejects an invitation whose code is %s', async (_case, code) => {
    await assertFails(setDoc(doc(as(FOUNDER), invitePath(A, code)), inviteDoc()));
  });
});

describe('attack: invitations — using one that must not work', () => {
  it('rejects one created exactly its days ago', async () => {
    await seedInvite(env, A, OTHER_INVITE_CODE, {}, TTL_MS);
    await assertFails(joinWith(as(NEWBIE), { d: A, code: OTHER_INVITE_CODE, uid: NEWBIE }));
  });

  it('rejects one a second past its days', async () => {
    await seedInvite(env, A, OTHER_INVITE_CODE, {}, TTL_MS + 1000);
    await assertFails(joinWith(as(NEWBIE), { d: A, code: OTHER_INVITE_CODE, uid: NEWBIE }));
  });

  it('rejects renewing its date in the batch that uses it', async () => {
    await seedInvite(env, A, OTHER_INVITE_CODE, {}, TTL_MS + 1000);
    await assertFails(
      joinWith(as(NEWBIE), {
        d: A,
        code: OTHER_INVITE_CODE,
        uid: NEWBIE,
        invite: { createdAt: serverTimestamp() },
      }),
    );
  });

  it.each([
    ['revoked', { status: 'revoked', revokedBy: FOUNDER, revokedAt: PAST }],
    ['used by someone else', { status: 'accepted', acceptedBy: 'driver-a', acceptedAt: PAST }],
  ])('rejects one that was %s', async (_case, change) => {
    await seedInvite(env, A, OTHER_INVITE_CODE, change);
    await assertFails(joinWith(as(NEWBIE), { d: A, code: OTHER_INVITE_CODE, uid: NEWBIE }));
  });

  it('rejects the code of an invitation of B used to join A', async () => {
    await seedInvite(env, B, OTHER_INVITE_CODE, { distributorName: 'Gas Demo' });
    const db = as(NEWBIE);
    const batch = writeBatch(db);
    batch.set(
      memberOf(db, NEWBIE),
      memberDoc(A, NEWBIE, 'driver', { displayName: PROFILE_NAME, inviteId: OTHER_INVITE_CODE }),
    );
    batch.update(inviteOf(db, B, OTHER_INVITE_CODE), {
      status: 'accepted',
      acceptedBy: NEWBIE,
      acceptedAt: serverTimestamp(),
      ...stamp,
    });
    await assertFails(batch.commit());
  });

  it.each([
    ['suspended', SUSPENDED, 'owner-suspended'],
    ['with its trial over', EXPIRED, 'owner-expired'],
  ])('rejects joining a distributor %s with an invitation still waiting', async (_case, d, by) => {
    await seedInvite(env, d, OTHER_INVITE_CODE, { createdBy: by });
    await assertFails(joinWith(as(NEWBIE), { d, code: OTHER_INVITE_CODE, uid: NEWBIE }));
  });

  it('rejects an account without a profile, which never accepted the terms', async () => {
    await assertFails(joinWith(as('stranger'), { d: A, code: INVITE_CODE, uid: 'stranger' }));
  });

  it.each([
    ['a session with a password', () => verifiedThrough(env, NEWBIE, 'password')],
    ['an anonymous session', () => signedInAnonymously(env, NEWBIE)],
    ['a Google session without a verified address', () => unverified(env, NEWBIE)],
  ])('rejects %s using a valid invitation', async (_who, db) => {
    await assertFails(joinWith(db(), { d: A, code: INVITE_CODE, uid: NEWBIE }));
  });

  describe('tied to an address', () => {
    beforeEach(async () => {
      await seedInvite(env, A, OTHER_INVITE_CODE, { email: 'persona@example.com' });
    });

    it.each([
      ['the address with dots, one mailbox for Gmail', 'per.sona@example.com'],
      ['the same address plus a tag', 'persona+x@example.com'],
      ['another domain', 'persona@example.org'],
      ['the address with a trailing space', 'persona@example.com '],
    ])('rejects an account whose token carries %s', async (_case, email) => {
      const db = googleWithEmail(NEWBIE, email);
      await assertFails(joinWith(db, { d: A, code: OTHER_INVITE_CODE, uid: NEWBIE }));
    });

    it('accepts the named account when Google writes its address in capitals', async () => {
      const db = googleWithEmail(NEWBIE, 'Persona@Example.COM');
      await assertSucceeds(joinWith(db, { d: A, code: OTHER_INVITE_CODE, uid: NEWBIE }));
    });

    it('rejects removing the address in the batch that uses it', async () => {
      await assertFails(
        joinWith(as(NEWBIE), {
          d: A,
          code: OTHER_INVITE_CODE,
          uid: NEWBIE,
          invite: { email: null },
        }),
      );
    });
  });

  it.each([
    ['owner', 'owner'],
    ['dispatcher', 'dispatcher'],
  ])('rejects joining as %s through an invitation for a driver', async (_case, role) => {
    await assertFails(
      joinWith(as(NEWBIE), { d: A, code: INVITE_CODE, uid: NEWBIE, role: role as 'owner' }),
    );
  });

  it('rejects raising the role of the invitation in the batch that uses it', async () => {
    await assertFails(
      joinWith(as(NEWBIE), {
        d: A,
        code: INVITE_CODE,
        uid: NEWBIE,
        role: 'owner',
        invite: { role: 'owner' },
      }),
    );
  });

  it('rejects marking the invitation used in the name of someone else', async () => {
    await assertFails(
      joinWith(as(NEWBIE), { d: A, code: INVITE_CODE, uid: NEWBIE, invite: { acceptedBy: 'x' } }),
    );
  });

  it('rejects marking it used with a date other than now', async () => {
    await assertFails(
      joinWith(as(NEWBIE), { d: A, code: INVITE_CODE, uid: NEWBIE, invite: { acceptedAt: PAST } }),
    );
  });

  it('rejects a member that names an invitation used before while marking another', async () => {
    await seedInvite(env, A, OTHER_INVITE_CODE, {
      status: 'accepted',
      acceptedBy: 'driver-a',
      acceptedAt: PAST,
    });
    await assertFails(
      joinWith(as(NEWBIE), {
        d: A,
        code: INVITE_CODE,
        uid: NEWBIE,
        member: { inviteId: OTHER_INVITE_CODE },
      }),
    );
  });

  it('rejects a member that names a waiting invitation while another is marked', async () => {
    await seedInvite(env, A, OTHER_INVITE_CODE, { role: 'dispatcher' });
    await assertFails(
      joinWith(as(NEWBIE), {
        d: A,
        code: INVITE_CODE,
        uid: NEWBIE,
        role: 'dispatcher',
        member: { inviteId: OTHER_INVITE_CODE },
      }),
    );
  });

  it.each([
    ['another name than its profile', { displayName: 'Titular Falso' }],
    ['another distributor name', { distributorName: 'Gas Famosa' }],
    ['another distributor id', { distributorId: B }],
    ['another uid', { uid: 'driver-a' }],
    ['switched off, to be switched on later', { active: false }],
    ['a field of its own', { platformAdmin: true }],
    ['an old creation date', { createdAt: PAST }],
  ])('rejects joining with a member carrying %s', async (_case, member) => {
    await assertFails(joinWith(as(NEWBIE), { d: A, code: INVITE_CODE, uid: NEWBIE, member }));
  });

  it('rejects a member of A taking a second invitation, as another role', async () => {
    await seedInvite(env, A, OTHER_INVITE_CODE, { role: 'dispatcher' });
    await assertFails(
      joinWith(as('driver-a'), {
        d: A,
        code: OTHER_INVITE_CODE,
        uid: 'driver-a',
        role: 'dispatcher',
      }),
    );
  });

  it('rejects the second of two accounts after the first one joined', async () => {
    await assertSucceeds(joinWith(as(NEWBIE), { d: A, code: INVITE_CODE, uid: NEWBIE }));
    await seedDoc(env, 'users/second', userDoc(seeded));
    await assertFails(joinWith(as('second'), { d: A, code: INVITE_CODE, uid: 'second' }));
  });
});

describe('attack: invitations — changing or removing one', () => {
  it.each([
    ['its role', { role: 'owner' }],
    ['its address', { email: `${NEWBIE}@example.com` }],
    ['its date, to renew it', { createdAt: serverTimestamp() }],
    ['its author', { createdBy: NEWBIE }],
    [
      'its status, revoking it',
      { status: 'revoked', revokedBy: NEWBIE, revokedAt: serverTimestamp() },
    ],
  ])('rejects whoever holds the code changing %s', async (_case, change) => {
    await assertFails(updateDoc(inviteOf(as(NEWBIE)), { ...change, ...stamp }));
  });

  it.each([
    ['its role', { role: 'dispatcher' }],
    ['its address', { email: 'otra@example.com' }],
    ['its date, to renew it', { createdAt: serverTimestamp() }],
    ['its author', { createdBy: CO_OWNER }],
  ])('rejects the founder changing %s of a waiting invitation', async (_case, change) => {
    await assertFails(updateDoc(inviteOf(as(FOUNDER)), { ...change, ...stamp }));
  });

  it('rejects the founder turning an invitation for a driver into one for an owner', async () => {
    await assertFails(
      updateDoc(inviteOf(as(FOUNDER)), { role: 'owner', email: 'socio@example.com', ...stamp }),
    );
  });

  it('rejects reopening a used invitation', async () => {
    await seedInvite(env, A, OTHER_INVITE_CODE, {
      status: 'accepted',
      acceptedBy: 'driver-a',
      acceptedAt: PAST,
    });
    const used = inviteOf(as(FOUNDER), A, OTHER_INVITE_CODE);
    await assertFails(
      updateDoc(used, {
        status: 'pending',
        acceptedBy: deleteField(),
        acceptedAt: deleteField(),
        ...stamp,
      }),
    );
  });

  it.each([
    ['its dispatcher', 'dispatcher-a'],
    ['its driver', 'driver-a'],
    ['the owner of B', 'owner-b'],
    ['a platform admin', ADMIN_UID],
    ['an owner that was switched off', CO_OWNER_OFF],
  ])('rejects %s revoking an invitation of A', async (_who, uid) => {
    await assertFails(revokeInvite(as(uid), A, INVITE_CODE, uid));
  });

  it.each([
    ['its founder', FOUNDER],
    ['whoever holds the code', NEWBIE],
    ['a platform admin', ADMIN_UID],
  ])('rejects %s deleting an invitation', async (_who, uid) => {
    await assertFails(deleteDoc(inviteOf(as(uid))));
  });
});

// ===================================================================================== staff ====
describe('attack: staff — nobody gives itself a role', () => {
  it.each([
    ['an owner', 'owner'],
    ['a driver', 'driver'],
  ])('rejects a customer creating its own member of A as %s', async (_case, role) => {
    await assertFails(
      setDoc(
        memberOf(as(NEWBIE), NEWBIE),
        memberDoc(A, NEWBIE, role as 'owner', { displayName: PROFILE_NAME }),
      ),
    );
  });

  it('rejects a customer creating its own member naming an invitation it did not use', async () => {
    await assertFails(
      setDoc(
        memberOf(as(NEWBIE), NEWBIE),
        memberDoc(A, NEWBIE, 'driver', { displayName: PROFILE_NAME, inviteId: INVITE_CODE }),
      ),
    );
  });

  it('rejects the owner of A creating a member for someone else', async () => {
    await assertFails(
      setDoc(
        memberOf(as(FOUNDER), NEWBIE),
        memberDoc(A, NEWBIE, 'dispatcher', { displayName: PROFILE_NAME }),
      ),
    );
  });

  it.each([
    ['its driver makes itself an owner', 'driver-a', { role: 'owner' }],
    ['its driver makes itself a dispatcher', 'driver-a', { role: 'dispatcher' }],
    ['its dispatcher makes itself an owner', 'dispatcher-a', { role: 'owner' }],
    ['a co-owner makes itself the founder', CO_OWNER, { role: 'owner', displayName: 'Fundador' }],
    ['an owner that was switched off switches itself on', CO_OWNER_OFF, { active: true }],
    ['a dispatcher that was switched off switches itself on', DISPATCHER_OFF, { active: true }],
    ['its driver renames itself', 'driver-a', { displayName: 'Titular' }],
  ])('rejects the change where %s', async (_case, uid, change) => {
    await assertFails(updateDoc(memberOf(as(uid), uid), { ...change, ...stamp }));
  });

  it.each([
    ['its dispatcher switches the driver off', 'dispatcher-a', 'driver-a', { active: false }],
    [
      'its dispatcher makes the driver a dispatcher',
      'dispatcher-a',
      'driver-a',
      { role: 'dispatcher' },
    ],
    ['its driver switches the dispatcher off', 'driver-a', 'dispatcher-a', { active: false }],
    [
      'an owner that was switched off switches the driver off',
      CO_OWNER_OFF,
      'driver-a',
      { active: false },
    ],
    [
      'a co-owner switches back on an owner the founder switched off',
      CO_OWNER,
      CO_OWNER_OFF,
      { active: true },
    ],
    ['a co-owner makes the founder a driver', CO_OWNER, FOUNDER, { role: 'driver' }],
    ['a co-owner makes the driver an owner', CO_OWNER, 'driver-a', { role: 'owner' }],
    ['the owner of B switches the driver of A off', 'owner-b', 'driver-a', { active: false }],
    ['the owner of B makes itself owner of A', 'owner-b', 'driver-a', { role: 'owner' }],
    ['a platform admin switches the driver of A off', ADMIN_UID, 'driver-a', { active: false }],
  ])('rejects the change where %s', async (_case, uid, target, change) => {
    await assertFails(updateDoc(memberOf(as(uid), target), { ...change, ...stamp }));
  });

  it.each([
    ['its uid', { uid: 'someone' }],
    ['its distributor id', { distributorId: B }],
    ['the invitation it joined with', { inviteId: OTHER_INVITE_CODE }],
    ['its creation date', { createdAt: serverTimestamp() }],
    ['the copy of the name, to a false one', { distributorName: 'Gas Famosa' }],
    ['a field of its own', { canApproveShifts: true }],
    ['a role outside the list', { role: 'admin' }],
    ['active as text', { active: 'true' }],
    ['a blank name', { displayName: ' ' }],
    ['a name too long', { displayName: 'a'.repeat(81) }],
  ])('rejects the founder changing %s of another member', async (_case, change) => {
    await assertFails(updateDoc(memberOf(as(FOUNDER), 'driver-a'), { ...change, ...stamp }));
  });

  it.each([
    ['the invitation it joined with', { inviteId: INVITE_CODE }],
    ['the copy of the name, to a false one', { distributorName: 'Gas Famosa' }],
    ['its distributor id', { distributorId: B }],
  ])('rejects a member changing %s of its own document', async (_case, change) => {
    await assertFails(updateDoc(memberOf(as('driver-a'), 'driver-a'), { ...change, ...stamp }));
  });

  it('rejects the founder of an expired trial changing its staff', async () => {
    await assertFails(
      updateDoc(memberOf(as('owner-expired'), 'driver-expired', EXPIRED), {
        active: false,
        ...stamp,
      }),
    );
  });

  it.each([
    ['the owner of B', 'owner-b'],
    ['a platform admin', ADMIN_UID],
  ])('rejects %s deleting a member of A', async (_who, uid) => {
    await assertFails(deleteDoc(memberOf(as(uid), 'driver-a')));
  });

  it.each([
    ['its driver', 'driver-a'],
    ['the owner of B', 'owner-b'],
    ['a dispatcher that was switched off', DISPATCHER_OFF],
    ['a customer', NEWBIE],
  ])('rejects %s listing the staff of A', async (_who, uid) => {
    await assertFails(getDocs(query(collection(as(uid), `distributors/${A}/members`), limit(5))));
  });

  it.each([
    ['without naming itself', () => [limit(5)]],
    ['naming someone else', () => [where('uid', '==', FOUNDER), limit(5)]],
    ['naming itself without a limit', () => [where('uid', '==', 'driver-a')]],
  ])('rejects the search of memberships %s', async (_case, constraints) => {
    const group = collectionGroup(as('driver-a'), 'members');
    await assertFails(getDocs(query(group, ...constraints())));
  });

  it.each([
    ['its driver', 'driver-a', FOUNDER],
    ['the owner of B', 'owner-b', 'driver-a'],
  ])('rejects %s reading a member of A that is not its own', async (_who, uid, target) => {
    await assertFails(getDoc(memberOf(as(uid), target)));
  });
});

// =================================================================================== helpers ====
describe('attack: helpers', () => {
  it.each([
    ['its dispatcher', 'dispatcher-a'],
    ['its driver', 'driver-a'],
    ['the owner of B', 'owner-b'],
    ['a platform admin', ADMIN_UID],
    ['an owner that was switched off', CO_OWNER_OFF],
  ])('rejects %s adding a helper to A', async (_who, uid) => {
    await assertFails(setDoc(helperOf(as(uid), 'h05'), helperDoc()));
  });

  it.each([
    ['its dispatcher', 'dispatcher-a'],
    ['its driver', 'driver-a'],
    ['the owner of B', 'owner-b'],
  ])('rejects %s renaming or switching off a helper of A', async (_who, uid) => {
    await seedDoc(env, helperPath(A, 'h00'), helperDoc(seeded));
    await assertFails(updateDoc(helperOf(as(uid), 'h00'), { name: 'Otro', ...stamp }));
    await assertFails(updateDoc(helperOf(as(uid), 'h00'), { active: false, ...stamp }));
  });

  it.each(['h30', 'h-1', 'h0a', 'h000', 'H00', 'h 0', 'h29 ', ' h00', 'hh0'])(
    'rejects a helper in slot "%s"',
    async (slot) => {
      await assertFails(setDoc(helperOf(as(FOUNDER), slot), helperDoc()));
    },
  );

  it('accepts the last slot and the longest name', async () => {
    await assertSucceeds(setDoc(helperOf(as(FOUNDER), 'h29'), helperDoc({ name: 'a'.repeat(60) })));
  });

  it.each([
    ['empty', ''],
    ['blank', '   '],
    ['a zero-width space alone', '\u200b'],
    ['a name with a zero-width space inside', 'Ana\u200bMaria'],
    ['a name that flips the writing', '\u202eanA'],
    ['a name with a null character', 'Ana\u0000'],
    ['punctuation alone', '...'],
    ['an emoji alone', '\u{1F600}'],
    ['too long', 'a'.repeat(61)],
    ['a number', 7],
  ])('rejects a helper named %s', async (_case, name) => {
    await assertFails(setDoc(helperOf(as(FOUNDER), 'h05'), helperDoc({ name })));
  });

  it.each([
    ['a phone', { phone: '900000003' }],
    ['an identity document', { dni: '00000000' }],
    ['active as text', { active: 'yes' }],
    ['an old creation date', { createdAt: PAST }],
  ])('rejects a helper carrying %s', async (_case, change) => {
    await assertFails(setDoc(helperOf(as(FOUNDER), 'h05'), helperDoc(change)));
  });

  it('rejects the owner deleting a helper', async () => {
    await seedDoc(env, helperPath(A, 'h00'), helperDoc(seeded));
    await assertFails(deleteDoc(helperOf(as(FOUNDER), 'h00')));
  });

  it('rejects the owner of a suspended distributor adding or editing one', async () => {
    await assertFails(setDoc(helperOf(as('owner-suspended'), 'h00', SUSPENDED), helperDoc()));
    await seedDoc(env, helperPath(SUSPENDED, 'h01'), helperDoc(seeded));
    await assertFails(
      updateDoc(helperOf(as('owner-suspended'), 'h01', SUSPENDED), { active: false, ...stamp }),
    );
  });

  it.each([
    ['a customer', NEWBIE],
    ['the driver of B', 'driver-b'],
    ['a dispatcher that was switched off', DISPATCHER_OFF],
  ])('rejects %s reading the helpers of A', async (_who, uid) => {
    await seedDoc(env, helperPath(A, 'h00'), helperDoc(seeded));
    await assertFails(getDoc(helperOf(as(uid), 'h00')));
    await assertFails(getDocs(query(collection(as(uid), `distributors/${A}/helpers`), limit(5))));
  });
});

// ============================================================================ the review note ====
describe('attack: the note of the platform', () => {
  const NOTE = 'El RUC no coincide con la razón social.';

  beforeEach(async () => {
    for (const [uid, role] of [
      [CO_OWNER, 'owner'],
      ['dispatcher-pending', 'dispatcher'],
    ] as const) {
      await seedDoc(env, memberPath(PENDING, uid), memberDoc(PENDING, uid, role, seeded));
    }
    await leaveNote(as(ADMIN_UID), PENDING, NOTE);
  });

  it.each([
    ['an owner that did not found it', CO_OWNER],
    ['its dispatcher', 'dispatcher-pending'],
    ['its driver', 'driver-pending'],
    ['the owner of A', FOUNDER],
    ['a customer', NEWBIE],
  ])('rejects %s reading its text', async (_who, uid) => {
    await assertFails(getDoc(doc(as(uid), reviewPath(PENDING))));
  });

  it.each([
    ['its founder', 'owner-pending'],
    ['an owner that did not found it', CO_OWNER],
  ])('rejects %s searching the private documents to reach it', async (_who, uid) => {
    const group = collectionGroup(as(uid), 'private');
    await assertFails(getDocs(query(group, where('listingApproved', '==', false), limit(5))));
    await assertFails(getDocs(query(group, where('writtenAt', '!=', null), limit(5))));
  });

  it.each([
    [
      'rewrites it',
      (db: Db) =>
        setDoc(doc(db, reviewPath(PENDING)), { note: 'Todo bien.', writtenAt: serverTimestamp() }),
    ],
    ['edits it', (db: Db) => updateDoc(doc(db, reviewPath(PENDING)), { note: 'Todo bien.' })],
    ['deletes it', (db: Db) => deleteDoc(doc(db, reviewPath(PENDING)))],
    [
      'removes its mark',
      (db: Db) => updateDoc(controlOf(db, PENDING), { reviewNoteAt: deleteField(), ...stamp }),
    ],
    [
      'moves its mark',
      (db: Db) => updateDoc(controlOf(db, PENDING), { reviewNoteAt: serverTimestamp(), ...stamp }),
    ],
  ])('rejects the founder when it %s', async (_case, write) => {
    await assertFails(write(as('owner-pending')));
  });
});

// ==================================================== the dispatcher and the public profile ====
describe('attack: the dispatcher and the public profile', () => {
  const edit = (uid: string, change: Record<string, unknown>, d = A) =>
    updateDoc(profileOf(as(uid), d), { ...change, ...stamp });

  it.each([
    ['the name', { name: 'Gas Famosa' }],
    ['the phone', { contactPhone: '900000099' }],
    ['the WhatsApp', { whatsapp: '900000099' }],
    ['the address', { addressLine: 'Av. Otra 300' }],
    ['the plant', { plant: { lat: -12.1, lng: -77.1 } }],
    ['the radius', { coverageRadiusKm: 50 }],
    ['the colour', { brandColor: '#000000' }],
    [
      'the schedule',
      { schedule: { days: [0, 1, 2, 3, 4, 5, 6], opensAt: '00:00', closesAt: '23:59' } },
    ],
    ['the cylinders per order', { maxCylindersPerOrder: 20 }],
    ['the link', { slug: 'gas-famosa' }],
    ['the currency', { currency: 'USD' }],
    ['the creation date', { createdAt: serverTimestamp() }],
    ['the public flag', { acceptingOrders: false }],
    ['a field of its own', { promo: 'Gratis' }],
  ])('rejects the dispatcher changing %s along with the copy', async (_case, change) => {
    await assertFails(edit('dispatcher-a', { priceFromCents: 3900, ...change }));
  });

  it.each([
    ['nine brands', { brands: ['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7', 'M8', 'M9'] }],
    ['an invisible brand', { brands: ['\u200b'] }],
    ['a brand that flips the writing', { brands: ['\u202eaMarca'] }],
    ['a brand too long', { brands: ['a'.repeat(31)] }],
    ['brands as text', { brands: 'Marca Uno' }],
    ['a "from" price above the cap', { priceFromCents: 99901 }],
    ['a "from" price with decimals', { priceFromCents: 39.5 }],
    ['a "from" price as text', { priceFromCents: '3900' }],
    ['a negative "from" price', { priceFromCents: -1 }],
  ])('rejects the dispatcher writing %s', async (_case, change) => {
    await assertFails(edit('dispatcher-a', change));
  });

  it('rejects the dispatcher of a suspended distributor writing the copy', async () => {
    await seedDoc(
      env,
      memberPath(SUSPENDED, 'dispatcher-suspended'),
      memberDoc(SUSPENDED, 'dispatcher-suspended', 'dispatcher', seeded),
    );
    await assertFails(edit('dispatcher-suspended', { priceFromCents: 3900 }, SUSPENDED));
  });

  it('rejects a dispatcher that was switched off writing the copy', async () => {
    await assertFails(edit(DISPATCHER_OFF, { priceFromCents: 3900 }));
  });

  it('rejects the dispatcher marking a correction of the owner', async () => {
    await assertFails(
      updateDoc(controlOf(as('dispatcher-a'), A), { correctedAt: serverTimestamp(), ...stamp }),
    );
  });

  // The heaviest write the dispatcher may send: the whole brand list (limit of expressions,
  // PLAN §9).
  it('lets the dispatcher write eight brands and a new "from" price at once', async () => {
    const brands = [
      'Marca 1',
      'Marca 2',
      'Marca 3',
      'Marca 4',
      'Marca 5',
      'Marca 6',
      'Marca 7',
      'Marca 8',
    ];
    await assertSucceeds(edit('dispatcher-a', { brands, priceFromCents: 3900 }));
  });

  // Accepted risk (PLAN §9, copies of the catalogue): every write of the profile moves the
  // version an approval names, so a hostile dispatcher can make an open review go stale as
  // often as it writes. These cases pin its exact reach: only a real change of the two copies,
  // only while the distributor is writable and the dispatcher is active; a driver cannot; the
  // admin approves again once it looks at the new version.
  describe('reach of the staling of an open review', () => {
    const approve = (marks: Record<string, unknown>) => {
      const db = as(ADMIN_UID);
      const batch = writeBatch(db);
      batch.update(controlOf(db, PENDING), {
        listingApproved: true,
        approvedAt: serverTimestamp(),
        approvedBy: ADMIN_UID,
        ...marks,
        ...stamp,
      });
      batch.update(profileOf(db, PENDING), { acceptingOrders: true, ...stamp });
      return batch.commit();
    };

    beforeEach(async () => {
      await seedDoc(
        env,
        memberPath(PENDING, 'dispatcher-pending'),
        memberDoc(PENDING, 'dispatcher-pending', 'dispatcher', seeded),
      );
    });

    it('lets a dispatcher make the version the admin opened stale', async () => {
      const seen = await reviewedMarks(env, PENDING);
      await assertSucceeds(edit('dispatcher-pending', { priceFromCents: 3900 }, PENDING));
      await assertFails(approve(seen));
      await assertSucceeds(approve(await reviewedMarks(env, PENDING)));
    });

    it('rejects a driver moving the version of an open review', async () => {
      await assertFails(edit('driver-pending', { priceFromCents: 3900 }, PENDING));
      await assertFails(edit('driver-pending', { acceptingOrders: false }, PENDING));
      await assertFails(edit('driver-pending', {}, PENDING));
    });

    it('rejects a dispatcher moving the version without changing the copies', async () => {
      await assertFails(edit('dispatcher-pending', {}, PENDING));
      await assertFails(edit('dispatcher-pending', { acceptingOrders: false }, PENDING));
      await assertFails(edit('dispatcher-pending', { brands: [], priceFromCents: null }, PENDING));
    });
  });
});

// ============================================================ names that are hard to read ====
// Found by rules-breaker (2026-10-15, BAJO) and closed the same day (PLAN §11): the name a member
// joins with is the name of its profile, and the staff reads it in its list, so it must be
// visible text whenever it is written — not a name of invisible characters nor one that flips
// the writing. A member stored before that check can still be switched off.
describe('names of the staff that nobody can read', () => {
  it.each([
    ['a zero-width space alone', '\u200b'],
    ['a name that flips the writing', '\u202eodalucinaS'],
  ])('rejects joining with a profile named %s', async (_case, name) => {
    await seedDoc(env, `users/${NEWBIE}`, userDoc({ displayName: name, ...seeded }));
    await assertFails(
      joinWith(as(NEWBIE), { d: A, code: INVITE_CODE, uid: NEWBIE, member: { displayName: name } }),
    );
  });

  it('rejects the founder renaming a member to an invisible name', async () => {
    await assertFails(
      updateDoc(memberOf(as(FOUNDER), 'driver-a'), { displayName: '\u200b', ...stamp }),
    );
  });

  it('rejects the founder renaming a member to a name with a control character', async () => {
    await assertFails(
      updateDoc(memberOf(as(FOUNDER), 'driver-a'), { displayName: 'Ana\u0007', ...stamp }),
    );
  });

  it('lets the founder rename a member to a visible name', async () => {
    await assertSucceeds(
      updateDoc(memberOf(as(FOUNDER), 'driver-a'), { displayName: 'R. Ñahui', ...stamp }),
    );
  });

  describe('a member stored with an invisible name before the check', () => {
    beforeEach(async () => {
      await seedDoc(
        env,
        memberPath(A, 'driver-a'),
        memberDoc(A, 'driver-a', 'driver', { displayName: '\u200b', ...seeded }),
      );
    });

    it('can still be switched off and back on by the founder', async () => {
      await assertSucceeds(
        updateDoc(memberOf(as(FOUNDER), 'driver-a'), { active: false, ...stamp }),
      );
      await assertSucceeds(
        updateDoc(memberOf(as(FOUNDER), 'driver-a'), { active: true, ...stamp }),
      );
    });

    it('can have its role changed without touching the name', async () => {
      await assertSucceeds(
        updateDoc(memberOf(as(FOUNDER), 'driver-a'), { role: 'dispatcher', ...stamp }),
      );
    });

    it('can refresh its copy of the distributor name by itself', async () => {
      await assertSucceeds(
        updateDoc(memberOf(as('driver-a'), 'driver-a'), {
          distributorName: DISTRIBUTOR_NAME,
          ...stamp,
        }),
      );
    });
  });
});
