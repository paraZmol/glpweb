import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { serverTimestamp } from 'firebase/firestore';
import {
  PRIVACY_VERSION,
  PRIVACY_VERSIONS,
  TERMS_VERSION,
  TERMS_VERSIONS,
} from '../../src/domain/legal/versions';
import { ADDRESS_SLOT_IDS } from '../../src/domain/tenancy/account-input';
import {
  ADDRESS_LABEL_MAX_LENGTH,
  ADDRESS_LINE_MAX_LENGTH,
  ADDRESS_REFERENCE_MAX_LENGTH,
  DISPLAY_NAME_MAX_LENGTH,
  MAX_ADDRESSES_PER_USER,
} from '../../src/domain/tenancy/constants';
import {
  acceptOnProfile,
  addressDoc,
  ADMIN_UID,
  anonymous,
  createEnv,
  createProfile,
  currentEntry,
  CUSTOMER_UID,
  privacyDoc,
  seedAcceptedProfile,
  seedDoc,
  seedWorld,
  termsDoc,
  unverified,
  verifiedThrough,
  userDoc,
  verified,
  WORLD,
} from './helpers';

let env: RulesTestEnvironment;
const NEWCOMER = 'newcomer';
const PAST = Timestamp.fromDate(new Date('2020-01-01T00:00:00Z'));

beforeAll(async () => {
  env = await createEnv('users');
});

beforeEach(async () => {
  await env.clearFirestore();
  await seedWorld(env);
});

afterAll(async () => {
  await env.cleanup();
});

describe('/users/{uid} — create', () => {
  it('lets an account with a verified e-mail create its own profile', async () => {
    await assertSucceeds(createProfile(verified(env, NEWCOMER), NEWCOMER, userDoc()));
    await assertSucceeds(
      createProfile(verified(env, 'second'), 'second', userDoc({ phone: '900000010' })),
    );
  });

  // PLAN 2.11: nothing is stored, consents included, for an address nobody proved is theirs.
  it('blocks an account whose e-mail is not verified from creating its profile', async () => {
    await assertFails(createProfile(unverified(env, NEWCOMER), NEWCOMER, userDoc()));
  });

  // PLAN 2.1: sign-in is with Google only, and a profile exists only for a verified e-mail.
  it.each(['password', 'custom', 'anonymous', 'emailLink', 'facebook.com'])(
    'blocks a verified session that came in through %s from creating its profile',
    async (provider) => {
      const db = verifiedThrough(env, NEWCOMER, provider);

      await assertFails(createProfile(db, NEWCOMER, userDoc()));
    },
  );

  it('blocks a verified session whose token does not say how it came in', async () => {
    const db = env
      .authenticatedContext(NEWCOMER, { email: 'newcomer@example.com', email_verified: true })
      .firestore();

    await assertFails(createProfile(db, NEWCOMER, userDoc()));
  });

  it('blocks an account without an e-mail claim at all', async () => {
    const db = env.authenticatedContext(NEWCOMER).firestore();
    await assertFails(createProfile(db, NEWCOMER, userDoc()));
  });

  it('blocks an unverified account from reading or touching its profile and addresses', async () => {
    const at = Timestamp.fromDate(new Date('2026-02-01T12:00:00Z'));
    const stamps = { createdAt: at, updatedAt: at };
    await seedDoc(env, `users/${NEWCOMER}`, userDoc(stamps));
    await seedDoc(env, `users/${NEWCOMER}/addresses/a0`, addressDoc(stamps));
    const db = unverified(env, NEWCOMER);
    const now = { updatedAt: serverTimestamp() };

    await assertFails(updateDoc(doc(db, `users/${NEWCOMER}`), { displayName: 'Otra', ...now }));
    await assertFails(acceptOnProfile(db, NEWCOMER, { terms: termsDoc() }));
    await assertFails(setDoc(doc(db, `users/${NEWCOMER}/addresses/a1`), addressDoc()));
    await assertFails(
      updateDoc(doc(db, `users/${NEWCOMER}/addresses/a0`), { label: 'Trabajo', ...now }),
    );
    // Nor reading or deleting what is already there (PLAN §11, 2026-10-14).
    await assertFails(getDoc(doc(db, `users/${NEWCOMER}`)));
    await assertFails(deleteDoc(doc(db, `users/${NEWCOMER}/addresses/a0`)));
  });

  it('blocks anonymous visitors', async () => {
    await assertFails(createProfile(anonymous(env), NEWCOMER, userDoc()));
  });

  it('blocks creating the profile of another account', async () => {
    await assertFails(createProfile(verified(env, 'intruder'), NEWCOMER, userDoc()));
  });

  it.each([
    ['role', { role: 'owner' }],
    ['isAdmin', { isAdmin: true }],
    ['platformAdmin', { platformAdmin: true }],
    ['roles map', { roles: { 'dist-a': 'owner' } }],
    ['status', { status: 'active' }],
    ['e-mail', { email: 'newcomer@example.com' }],
    ['arbitrary field', { anything: 1 }],
  ])('blocks the extra field %s', async (_field, extra) => {
    await assertFails(createProfile(verified(env, NEWCOMER), NEWCOMER, userDoc(extra)));
  });

  it.each([
    ['numeric name', { displayName: 42 }],
    ['empty name', { displayName: '' }],
    ['oversized name', { displayName: 'n'.repeat(DISPLAY_NAME_MAX_LENGTH + 1) }],
    ['megabyte name', { displayName: 'n'.repeat(900_000) }],
    ['numeric phone', { phone: 900000010 }],
    ['landline phone', { phone: '012345678' }],
    ['phone with prefix', { phone: '+51900000010' }],
    ['empty phone', { phone: '' }],
    ['owned list as text', { ownedDistributorIds: 'dist-a' }],
    ['owned list as map', { ownedDistributorIds: { 0: 'dist-a' } }],
    ['createdAt as text', { createdAt: '2026-01-01' }],
    ['updatedAt as number', { updatedAt: 1 }],
  ])('blocks %s', async (_case, change) => {
    await assertFails(createProfile(verified(env, NEWCOMER), NEWCOMER, userDoc(change)));
  });

  it.each([
    'displayName',
    'phone',
    'ownedDistributorIds',
    'terms',
    'privacy',
    'createdAt',
    'updatedAt',
  ])('blocks a profile without %s', async (field) => {
    const { [field]: _dropped, ...partial } = userDoc() as Record<string, unknown>;
    await assertFails(createProfile(verified(env, NEWCOMER), NEWCOMER, partial));
  });

  it('blocks a made-up createdAt or updatedAt', async () => {
    const db = verified(env, NEWCOMER);
    await assertFails(createProfile(db, NEWCOMER, userDoc({ createdAt: PAST })));
    await assertFails(createProfile(db, NEWCOMER, userDoc({ updatedAt: PAST })));
  });

  it('blocks a profile that already claims distributors', async () => {
    const claim = userDoc({ ownedDistributorIds: [WORLD.a.d] });
    await assertFails(createProfile(verified(env, NEWCOMER), NEWCOMER, claim));
  });
});

// PLAN 2.7 and 2.9: two consents, each with its own version and server date. The history entry
// that every acceptance must leave has its own file: acceptance-history.rules.test.ts.
describe.each([
  ['terms', TERMS_VERSION, TERMS_VERSIONS, termsDoc],
  ['privacy', PRIVACY_VERSION, PRIVACY_VERSIONS, privacyDoc],
] as const)('/users/{uid} — acceptance of %s', (field, current, versions, acceptance) => {
  const own = () => doc(verified(env, CUSTOMER_UID), `users/${CUSTOMER_UID}`);
  const newcomer = () => verified(env, NEWCOMER);
  const stamp = { updatedAt: serverTimestamp() };

  it.each([...versions])('accepts a new profile on version %s', async (version) => {
    const profile = userDoc({ [field]: acceptance({ version }) });

    await assertSucceeds(createProfile(newcomer(), NEWCOMER, profile));
  });

  it.each([
    ['a version that does not exist', acceptance({ version: '9.9' })],
    ['the version that named several texts', acceptance({ version: '0.1' })],
    ['an empty version', acceptance({ version: '' })],
    ['a numeric version', acceptance({ version: 0.2 })],
    ['a made-up acceptance date', acceptance({ acceptedAt: PAST })],
    ['an acceptance date as text', acceptance({ acceptedAt: '2026-01-01' })],
    ['no acceptance date', { version: current }],
    ['no version', { acceptedAt: serverTimestamp() }],
    ['an extra key', acceptance({ ip: '127.0.0.1' })],
    ['the acceptance as a flag', true],
    ['the acceptance as text', current],
    ['the acceptance as null', null],
  ])('blocks a new profile with %s', async (_case, value) => {
    await assertFails(createProfile(newcomer(), NEWCOMER, userDoc({ [field]: value })));
  });

  // The seeded profile holds the current version without a history entry, like one from before
  // the history existed: it can still leave its proof, once.
  it('lets a profile without history accept, stamped now', async () => {
    const db = verified(env, CUSTOMER_UID);

    await assertSucceeds(acceptOnProfile(db, CUSTOMER_UID, { [field]: acceptance() }));
  });

  it('leaves the acceptance alone when the profile is edited', async () => {
    const before = (await getDoc(own())).data()?.[field];
    await updateDoc(own(), { displayName: 'C. Otra', ...stamp });

    expect((await getDoc(own())).data()?.[field]).toEqual(before);
  });

  // Each attack carries the well-formed entry of the current version, so it is refused for
  // what it does to the profile and not for a missing entry.
  it.each([
    ['a version that does not exist', { [field]: acceptance({ version: '9.9' }) }],
    ['a made-up acceptance date', { [field]: acceptance({ acceptedAt: PAST }) }],
    ['only the version, keeping the old date', { [`${field}.version`]: `${current}.1` }],
    ['a backdated date, keeping the version', { [`${field}.acceptedAt`]: PAST }],
    ['an extra key', { [`${field}.note`]: 'x' }],
    ['the acceptance removed', { [field]: deleteField() }],
    ['the acceptance date removed', { [`${field}.acceptedAt`]: deleteField() }],
    ['the acceptance as null', { [field]: null }],
  ])('blocks an update with %s', async (_case, change) => {
    const db = verified(env, CUSTOMER_UID);

    await assertFails(acceptOnProfile(db, CUSTOMER_UID, change, currentEntry(field)));
  });

  it('blocks accepting in the name of another account', async () => {
    const intruder = verified(env, 'owner-a');

    await assertFails(acceptOnProfile(intruder, CUSTOMER_UID, { [field]: acceptance() }));
  });
});

describe('/users/{uid} — both consents together (PLAN 2.9)', () => {
  const stamp = { updatedAt: serverTimestamp() };

  it('lets a profile without history accept both in one request', async () => {
    const db = verified(env, CUSTOMER_UID);
    const both = { terms: termsDoc(), privacy: privacyDoc() };

    await assertSucceeds(acceptOnProfile(db, CUSTOMER_UID, both));
  });

  it('lets a profile older than the privacy consent gain it, and nothing else until then', async () => {
    await seedAcceptedProfile(env, 'older', { terms: TERMS_VERSION });
    const db = verified(env, 'older');
    const own = doc(db, 'users/older');

    await assertFails(updateDoc(own, { displayName: 'C. Otra', ...stamp }));
    await assertSucceeds(acceptOnProfile(db, 'older', { privacy: privacyDoc() }));
    await assertSucceeds(updateDoc(own, { displayName: 'C. Otra', ...stamp }));
  });
});

describe('/users/{uid} — read', () => {
  it('lets the account read its own profile', async () => {
    await assertSucceeds(getDoc(doc(verified(env, CUSTOMER_UID), `users/${CUSTOMER_UID}`)));
  });

  it.each([
    ['another customer', 'other-customer'],
    ['the owner of a distributor', 'owner-a'],
    ['a dispatcher', 'dispatcher-a'],
    ['a platform admin', ADMIN_UID],
  ])('blocks %s from reading someone else', async (_who, uid) => {
    await assertFails(getDoc(doc(verified(env, uid), `users/${CUSTOMER_UID}`)));
  });

  it('blocks anonymous visitors', async () => {
    await assertFails(getDoc(doc(anonymous(env), `users/${CUSTOMER_UID}`)));
  });

  it('blocks listing profiles, even with a limit', async () => {
    const db = verified(env, CUSTOMER_UID);
    await assertFails(getDocs(query(collection(db, 'users'), limit(1))));
  });
});

describe('/users/{uid} — update and delete', () => {
  const own = () => doc(verified(env, CUSTOMER_UID), `users/${CUSTOMER_UID}`);
  const stamp = { updatedAt: serverTimestamp() };

  it('lets the account edit its name and phone', async () => {
    await assertSucceeds(
      updateDoc(own(), { displayName: 'C. Otra', phone: '900000011', ...stamp }),
    );
    await assertSucceeds(updateDoc(own(), { phone: null, ...stamp }));
  });

  it('blocks editing another account', async () => {
    const db = verified(env, 'owner-a');
    await assertFails(updateDoc(doc(db, `users/${CUSTOMER_UID}`), { displayName: 'X', ...stamp }));
  });

  it.each([
    ['a role', { role: 'owner' }],
    ['a platform flag', { platformAdmin: true }],
    ['an invalid phone', { phone: '123' }],
    ['an oversized name', { displayName: 'n'.repeat(DISPLAY_NAME_MAX_LENGTH + 1) }],
    ['an empty name', { displayName: '' }],
    ['a new createdAt', { createdAt: serverTimestamp() }],
  ])('blocks an update that sets %s', async (_case, change) => {
    await assertFails(updateDoc(own(), { ...change, ...stamp }));
  });

  it('blocks an update without a fresh updatedAt', async () => {
    await assertFails(updateDoc(own(), { displayName: 'C. Otra' }));
    await assertFails(updateDoc(own(), { displayName: 'C. Otra', updatedAt: PAST }));
  });

  it.each([
    ['a distributor of someone else', [WORLD.a.d]],
    ['a distributor that does not exist', ['dist-ghost']],
    ['something that is not an id', [42]],
  ])('blocks claiming %s', async (_case, ownedDistributorIds) => {
    await assertFails(updateDoc(own(), { ownedDistributorIds, ...stamp }));
  });

  it('blocks a founder from forgetting or re-claiming a distributor', async () => {
    const founder = doc(verified(env, 'owner-a'), 'users/owner-a');
    await assertFails(updateDoc(founder, { ownedDistributorIds: [], ...stamp }));
    await assertFails(
      updateDoc(founder, { ownedDistributorIds: [WORLD.a.d, WORLD.a.d], ...stamp }),
    );
  });

  it('blocks deleting the profile, which would reset the list of founded distributors', async () => {
    await assertFails(deleteDoc(own()));
    await assertFails(deleteDoc(doc(verified(env, 'owner-a'), 'users/owner-a')));
  });
});

describe('/users/{uid}/addresses/{slot}', () => {
  const pathOf = (slot: string, uid = CUSTOMER_UID) => `users/${uid}/addresses/${slot}`;
  const stamp = { updatedAt: serverTimestamp() };

  it('lets the account create, read, edit and delete its addresses', async () => {
    const db = verified(env, CUSTOMER_UID);
    await assertSucceeds(setDoc(doc(db, pathOf('a0')), addressDoc()));
    await assertSucceeds(getDoc(doc(db, pathOf('a0'))));
    await assertSucceeds(updateDoc(doc(db, pathOf('a0')), { label: 'Trabajo', ...stamp }));
    await assertSucceeds(deleteDoc(doc(db, pathOf('a0'))));
  });

  it('lets the account list its own addresses with a bounded query', async () => {
    const db = verified(env, CUSTOMER_UID);
    const own = collection(db, `users/${CUSTOMER_UID}/addresses`);
    await assertSucceeds(getDocs(query(own, limit(MAX_ADDRESSES_PER_USER))));
    await assertFails(getDocs(own));
    await assertFails(getDocs(query(own, limit(MAX_ADDRESSES_PER_USER + 1))));
  });

  it('accepts every slot and nothing else, which caps addresses per account', async () => {
    const db = verified(env, CUSTOMER_UID);
    for (const slot of ADDRESS_SLOT_IDS) {
      await assertSucceeds(setDoc(doc(db, pathOf(slot)), addressDoc()));
    }
    for (const id of ['a10', 'a', 'b0', 'A0', 'a0x', 'kJ3xZ9automaticId0000']) {
      await assertFails(setDoc(doc(db, pathOf(id)), addressDoc()));
    }
  });

  it.each([
    ['an anonymous visitor', () => anonymous(env)],
    ['another customer', () => verified(env, 'other-customer')],
    ['an owner', () => verified(env, 'owner-a')],
    ['a platform admin', () => verified(env, ADMIN_UID)],
  ])('blocks %s from reading or writing them', async (_who, connect) => {
    await seedDoc(env, pathOf('a0'), addressDoc({ createdAt: PAST, updatedAt: PAST }));
    const db = connect();
    await assertFails(getDoc(doc(db, pathOf('a0'))));
    await assertFails(getDocs(query(collection(db, `users/${CUSTOMER_UID}/addresses`), limit(5))));
    await assertFails(setDoc(doc(db, pathOf('a1')), addressDoc()));
    await assertFails(updateDoc(doc(db, pathOf('a0')), { label: 'X', ...stamp }));
    await assertFails(deleteDoc(doc(db, pathOf('a0'))));
  });

  it.each([
    ['latitude above 90', { location: { lat: 90.01, lng: 0 } }],
    ['latitude below -90', { location: { lat: -91, lng: 0 } }],
    ['longitude above 180', { location: { lat: 0, lng: 180.5 } }],
    ['longitude below -180', { location: { lat: 0, lng: -181 } }],
    ['latitude as text', { location: { lat: '-12', lng: -77 } }],
    ['NaN latitude', { location: { lat: Number.NaN, lng: 0 } }],
    ['infinite longitude', { location: { lat: 0, lng: Number.POSITIVE_INFINITY } }],
    ['location without lng', { location: { lat: 0 } }],
    ['location with an extra key', { location: { lat: 0, lng: 0, accuracy: 5 } }],
    ['location as a list', { location: [0, 0] }],
    ['empty label', { label: '' }],
    ['oversized label', { label: 'l'.repeat(ADDRESS_LABEL_MAX_LENGTH + 1) }],
    ['empty address line', { addressLine: '' }],
    ['oversized address line', { addressLine: 'a'.repeat(ADDRESS_LINE_MAX_LENGTH + 1) }],
    ['oversized reference', { reference: 'r'.repeat(ADDRESS_REFERENCE_MAX_LENGTH + 1) }],
    ['numeric reference', { reference: 7 }],
    ['extra field', { isDefault: true }],
    ['made-up createdAt', { createdAt: PAST }],
    ['made-up updatedAt', { updatedAt: PAST }],
  ])('blocks an address with %s, on create and on update', async (_case, change) => {
    const db = verified(env, CUSTOMER_UID);
    await seedDoc(env, pathOf('a0'), addressDoc({ createdAt: PAST, updatedAt: PAST }));
    const update = 'createdAt' in change ? { createdAt: serverTimestamp() } : change;

    await assertFails(setDoc(doc(db, pathOf('a1')), addressDoc(change)));
    await assertFails(updateDoc(doc(db, pathOf('a0')), { ...stamp, ...update }));
  });

  it('accepts the edges of the coordinate range', async () => {
    const db = verified(env, CUSTOMER_UID);
    const edge = addressDoc({ location: { lat: -90, lng: 180 } });
    await assertSucceeds(setDoc(doc(db, pathOf('a0')), edge));
  });
});

describe('/platformAdmins/{uid}', () => {
  it('lets a platform admin read only its own document', async () => {
    const db = verified(env, ADMIN_UID);
    await assertSucceeds(getDoc(doc(db, `platformAdmins/${ADMIN_UID}`)));
    await assertFails(getDoc(doc(db, 'platformAdmins/someone-else')));
  });

  it('blocks everyone else from reading an admin document', async () => {
    await assertFails(getDoc(doc(anonymous(env), `platformAdmins/${ADMIN_UID}`)));
    await assertFails(getDoc(doc(verified(env, 'owner-a'), `platformAdmins/${ADMIN_UID}`)));
  });

  it('blocks listing admins, even for an admin', async () => {
    const db = verified(env, ADMIN_UID);
    await assertFails(getDocs(query(collection(db, 'platformAdmins'), limit(1))));
  });

  it.each([
    ['a customer', CUSTOMER_UID],
    ['an owner', 'owner-a'],
    ['an existing admin', ADMIN_UID],
  ])('blocks %s from granting, editing or revoking admin from the app', async (_who, uid) => {
    const db = verified(env, uid);
    await assertFails(setDoc(doc(db, `platformAdmins/${uid}`), { createdAt: serverTimestamp() }));
    await assertFails(setDoc(doc(db, 'platformAdmins/friend'), { createdAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(db, `platformAdmins/${ADMIN_UID}`), { note: 'x' }));
    await assertFails(deleteDoc(doc(db, `platformAdmins/${ADMIN_UID}`)));
  });
});
