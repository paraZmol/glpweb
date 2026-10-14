// PLAN §11 (2026-10-14): every read and write of the data of an account or of a distributor
// demands a session that came in through Google with a verified e-mail — the account's own
// profile, addresses and history, the founding of a distributor, its private documents, its
// members, the edit of its public profile, and everything a platform admin does.
//
// Each case runs twice over the same seeded world: with a Google session it goes through, which
// proves the case is well formed; with any other kind of session on the SAME account — one that
// already has a profile and a distributor — it is refused.
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
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { MAX_ACCEPTANCE_ENTRIES, TERMS_VERSION } from '../../src/domain/legal/versions';
import {
  MAX_ADDRESSES_PER_USER,
  MEMBERS_QUERY_LIMIT,
  MEMBERSHIPS_QUERY_LIMIT,
  PENDING_LISTINGS_LIMIT,
} from '../../src/domain/tenancy/constants';
import {
  ADMIN_UID,
  addressDoc,
  anonymous,
  createEnv,
  type Db,
  DISTRIBUTOR_NAME,
  editIdentity,
  entryPath,
  foundDistributor,
  newDistributorId,
  seedDoc,
  seedWorld,
  signedInAnonymously,
  unverified,
  verified,
  verifiedThrough,
  WORLD,
} from './helpers';

let env: RulesTestEnvironment;
const OWNER = 'owner-a';
const A = WORLD.a.d;
const PENDING = WORLD.pending.d;
const AT = Timestamp.fromDate(new Date('2026-02-01T12:00:00Z'));
const stamp = { updatedAt: serverTimestamp() };

beforeAll(async () => {
  env = await createEnv('google-session-only');
});

// The founder of A, with an address and a line of its history of acceptances.
beforeEach(async () => {
  await env.clearFirestore();
  await seedWorld(env);
  await seedDoc(env, `users/${OWNER}/addresses/a0`, addressDoc({ createdAt: AT, updatedAt: AT }));
  await seedDoc(env, entryPath(OWNER, 'terms'), {
    document: 'terms',
    version: TERMS_VERSION,
    acceptedAt: AT,
  });
});

afterAll(async () => {
  await env.cleanup();
});

type Case = [string, string, (db: Db) => Promise<unknown>];

const settingsOf = (db: Db, d: string) => doc(db, `distributors/${d}/private/settings`);
const controlOf = (db: Db, d: string) => doc(db, `distributors/${d}/private/control`);

/** The account's own data. */
const OWN: Case[] = [
  ['read its profile', OWNER, (db) => getDoc(doc(db, `users/${OWNER}`))],
  [
    'edit its profile',
    OWNER,
    (db) => updateDoc(doc(db, `users/${OWNER}`), { displayName: 'B. Persona', ...stamp }),
  ],
  ['read an address', OWNER, (db) => getDoc(doc(db, `users/${OWNER}/addresses/a0`))],
  [
    'list its addresses',
    OWNER,
    (db) =>
      getDocs(query(collection(db, `users/${OWNER}/addresses`), limit(MAX_ADDRESSES_PER_USER))),
  ],
  ['save an address', OWNER, (db) => setDoc(doc(db, `users/${OWNER}/addresses/a1`), addressDoc())],
  [
    'edit an address',
    OWNER,
    (db) => updateDoc(doc(db, `users/${OWNER}/addresses/a0`), { label: 'Trabajo', ...stamp }),
  ],
  ['delete an address', OWNER, (db) => deleteDoc(doc(db, `users/${OWNER}/addresses/a0`))],
  ['read its history', OWNER, (db) => getDoc(doc(db, entryPath(OWNER, 'terms')))],
  [
    'list its history',
    OWNER,
    (db) =>
      getDocs(query(collection(db, `users/${OWNER}/acceptances`), limit(MAX_ACCEPTANCE_ENTRIES))),
  ],
  [
    'find its memberships',
    OWNER,
    (db) =>
      getDocs(
        query(
          collectionGroup(db, 'members'),
          where('uid', '==', OWNER),
          limit(MEMBERSHIPS_QUERY_LIMIT),
        ),
      ),
  ],
];

/** What the owner does with its distributor. */
const DISTRIBUTOR: Case[] = [
  [
    'found another distributor (link included)',
    OWNER,
    (db) => foundDistributor(db, { d: newDistributorId('Fresh'), uid: OWNER, slug: 'gas-fresca' }),
  ],
  ['read its control document', OWNER, (db) => getDoc(controlOf(db, A))],
  ['read its private settings', OWNER, (db) => getDoc(settingsOf(db, A))],
  [
    'edit its private settings',
    OWNER,
    (db) => updateDoc(settingsOf(db, A), { ownerName: 'B. Persona', ...stamp }),
  ],
  [
    'edit its public profile',
    OWNER,
    (db) => updateDoc(doc(db, `distributors/${A}`), { brandColor: '#0a7cff', ...stamp }),
  ],
  [
    'edit its phone and send the listing back to review',
    OWNER,
    (db) => editIdentity(db, A, { contactPhone: '900000003' }),
  ],
  [
    'read its unlisted public profile',
    'owner-pending',
    (db) => getDoc(doc(db, `distributors/${PENDING}`)),
  ],
  [
    'read its own member document',
    OWNER,
    (db) => getDoc(doc(db, `distributors/${A}/members/${OWNER}`)),
  ],
  [
    'list the staff',
    OWNER,
    (db) => getDocs(query(collection(db, `distributors/${A}/members`), limit(MEMBERS_QUERY_LIMIT))),
  ],
  [
    'refresh its copy of the name',
    OWNER,
    (db) =>
      updateDoc(doc(db, `distributors/${A}/members/${OWNER}`), {
        distributorName: DISTRIBUTOR_NAME,
        ...stamp,
      }),
  ],
  [
    'deactivate a driver',
    OWNER,
    (db) => updateDoc(doc(db, `distributors/${A}/members/driver-a`), { active: false, ...stamp }),
  ],
  [
    'close the public profile of a distributor that cannot take orders (a driver)',
    'driver-expired',
    async (db) => {
      await seedDoc(env, `distributors/${WORLD.expired.d}`, {
        ...(await publicProfileOf(WORLD.expired.d)),
        acceptingOrders: true,
      });
      return updateDoc(doc(db, `distributors/${WORLD.expired.d}`), {
        acceptingOrders: false,
        ...stamp,
      });
    },
  ],
];

/** What only a platform admin does. */
const PLATFORM: Case[] = [
  [
    'read its own admin document',
    ADMIN_UID,
    (db) => getDoc(doc(db, `platformAdmins/${ADMIN_UID}`)),
  ],
  [
    'list the listings waiting for review',
    ADMIN_UID,
    (db) =>
      getDocs(
        query(
          collectionGroup(db, 'private'),
          where('listingApproved', '==', false),
          limit(PENDING_LISTINGS_LIMIT),
        ),
      ),
  ],
  ['read the private settings of a distributor', ADMIN_UID, (db) => getDoc(settingsOf(db, A))],
  [
    'read an unlisted public profile',
    ADMIN_UID,
    (db) => getDoc(doc(db, `distributors/${PENDING}`)),
  ],
  [
    'read the history of another account',
    ADMIN_UID,
    (db) => getDoc(doc(db, entryPath(OWNER, 'terms'))),
  ],
  [
    'suspend a distributor',
    ADMIN_UID,
    (db) => {
      const batch = writeBatch(db);
      batch.update(controlOf(db, A), { status: 'suspended', ...stamp });
      batch.update(doc(db, `distributors/${A}`), { acceptingOrders: false, ...stamp });
      return batch.commit();
    },
  ],
];

async function publicProfileOf(d: string): Promise<Record<string, unknown>> {
  let data: Record<string, unknown> = {};
  await env.withSecurityRulesDisabled(async (context) => {
    data = (await getDoc(doc(context.firestore(), `distributors/${d}`))).data() ?? {};
  });
  return data;
}

const CASES = [...OWN, ...DISTRIBUTOR, ...PLATFORM];

/** Every way to hold a session on that account that is not Google with a verified e-mail. */
const OTHER_SESSIONS: [string, (uid: string) => Db][] = [
  ['a password session', (uid) => verifiedThrough(env, uid, 'password')],
  ['an anonymous session', (uid) => signedInAnonymously(env, uid)],
  [
    'an anonymous session that claims a verified e-mail',
    (uid) => verifiedThrough(env, uid, 'anonymous'),
  ],
  ['a custom-token session', (uid) => env.authenticatedContext(uid).firestore()],
  ['a Google session without a verified e-mail', (uid) => unverified(env, uid)],
];

describe('with a Google session and a verified e-mail', () => {
  it.each(CASES)('lets the account %s', async (_action, uid, act) => {
    await assertSucceeds(act(verified(env, uid)));
  });
});

describe.each(OTHER_SESSIONS)('with %s on the same account', (_session, sessionOf) => {
  it.each(CASES)('blocks it from trying to %s', async (_action, uid, act) => {
    await assertFails(act(sessionOf(uid)));
  });
});

describe('without a session', () => {
  it.each(CASES)('blocks a visitor from trying to %s', async (_action, _uid, act) => {
    await assertFails(act(anonymous(env)));
  });
});
