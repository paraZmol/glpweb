import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SEED_CUSTOMER_LOCATION, SEED_PASSWORD, SEED_USERS } from '../../tests/seed/data';
import { seedEmulators } from '../../tests/seed/seed';
import { CURRENT_LEGAL_VERSIONS, PRIVACY_VERSION, TERMS_VERSION } from '../domain/legal/versions';
import { ADDRESS_SLOT_IDS } from '../domain/tenancy/account-input';
import { MAX_ADDRESSES_PER_USER } from '../domain/tenancy/constants';
import { markEmailVerified, rewindAcceptance } from '../../tests/support/emulator';
import {
  AddressLimitError,
  OfflineError,
  PermissionDeniedError,
  ProfileRequiredError,
} from '../domain/tenancy/errors';
import { refreshSession, registerWithEmail, signInWithEmail, signOutSession } from './auth-repo';
import { isPlatformAdmin } from './platform-repo';
import {
  acceptLegalVersions,
  addAddress,
  createUserProfile,
  deleteAddress,
  getUserProfile,
  listAddresses,
  listLegalAcceptances,
  updateAddress,
  updateUserProfile,
} from './users-repo';

/** The emulator and the test share a machine, but allow for a coarse clock. */
const CLOCK_SLACK_MS = 5_000;

const HOME = {
  label: 'Casa',
  addressLine: 'Calle Uno 123',
  reference: 'Portón verde',
  location: SEED_CUSTOMER_LOCATION,
};

beforeAll(async () => {
  await seedEmulators();
});

afterAll(async () => {
  await signOutSession();
});

// PLAN 2.1
describe('profile', () => {
  it('creates the profile with both acceptances, stamped by the server', async () => {
    const session = await signInWithEmail(SEED_USERS.noProfile.email, SEED_PASSWORD);
    const before = Date.now();

    expect(await getUserProfile(session.uid)).toBeNull();
    await createUserProfile(
      session.uid,
      { displayName: 'L. Reciente', phone: null },
      CURRENT_LEGAL_VERSIONS,
    );

    const created = await getUserProfile(session.uid);
    expect(created).toMatchObject({
      displayName: 'L. Reciente',
      phone: null,
      ownedDistributorIds: [],
      terms: { version: TERMS_VERSION },
      privacy: { version: PRIVACY_VERSION },
    });
    expect(created?.terms?.acceptedAt.getTime()).toBeGreaterThan(before - CLOCK_SLACK_MS);
    expect(created?.privacy?.acceptedAt).toEqual(created?.terms?.acceptedAt);
  });

  // PLAN 2.11: every acceptance leaves its line in the history, in the same batch.
  it('leaves one history entry per text, dated like the profile', async () => {
    const registered = await registerWithEmail({
      email: 'deja-constancia@example.com',
      password: SEED_PASSWORD,
    });
    await markEmailVerified(registered.uid);
    const { uid } = (await refreshSession()) ?? registered;

    await createUserProfile(
      uid,
      { displayName: 'O. Constancia', phone: null },
      CURRENT_LEGAL_VERSIONS,
    );

    const profile = await getUserProfile(uid);
    const history = await listLegalAcceptances(uid);
    expect(history.toSorted((a, b) => a.id.localeCompare(b.id))).toEqual([
      { id: `privacy-${PRIVACY_VERSION}`, document: 'privacy', ...profile?.privacy },
      { id: `terms-${TERMS_VERSION}`, document: 'terms', ...profile?.terms },
    ]);
  });

  it.each([
    ['of the terms', { ...CURRENT_LEGAL_VERSIONS, termsVersion: '9.9' }],
    ['of the privacy policy', { ...CURRENT_LEGAL_VERSIONS, privacyVersion: '9.9' }],
  ])('refuses a profile that accepts a version %s that does not exist', async (_case, versions) => {
    const registered = await registerWithEmail({
      email: `perfil-${versions.termsVersion}-${versions.privacyVersion}@example.com`,
      password: SEED_PASSWORD,
    });
    await markEmailVerified(registered.uid);
    const session = (await refreshSession()) ?? registered;
    const profile = { displayName: 'M. Perfil', phone: null };

    await expect(createUserProfile(session.uid, profile, versions)).rejects.toBeInstanceOf(
      PermissionDeniedError,
    );
    expect(await getUserProfile(session.uid)).toBeNull();
  });

  // PLAN 2.11: nothing is stored for an e-mail nobody proved is theirs.
  it('stores no profile and no address for an account whose e-mail is not verified', async () => {
    const session = await registerWithEmail({
      email: 'aun-sin-verificar@example.com',
      password: SEED_PASSWORD,
    });
    const profile = { displayName: 'N. Sin Verificar', phone: null };

    await expect(
      createUserProfile(session.uid, profile, CURRENT_LEGAL_VERSIONS),
    ).rejects.toBeInstanceOf(PermissionDeniedError);
    await expect(addAddress(session.uid, HOME)).rejects.toBeInstanceOf(PermissionDeniedError);

    await markEmailVerified(session.uid);
    await refreshSession();
    await createUserProfile(session.uid, profile, CURRENT_LEGAL_VERSIONS);
    expect(await addAddress(session.uid, HOME)).toBe('a0');
  });

  it('updates the name and the phone', async () => {
    const { uid } = await signInWithEmail(SEED_USERS.customer.email, SEED_PASSWORD);

    await updateUserProfile(uid, { displayName: 'I. Cliente Editado', phone: '900000052' });

    expect(await getUserProfile(uid)).toMatchObject({
      displayName: 'I. Cliente Editado',
      phone: '900000052',
    });
  });

  it('refuses to save the profile of an account that has none', async () => {
    const { uid } = await registerWithEmail({
      email: 'guarda-sin-perfil@example.com',
      password: SEED_PASSWORD,
    });

    await expect(updateUserProfile(uid, { displayName: 'X', phone: null })).rejects.toBeInstanceOf(
      ProfileRequiredError,
    );
  });

  // PLAN 2.11 (defect found by flow-tester): a save never waits for ever.
  it('gives up with OfflineError when the server does not answer within the deadline', async () => {
    const { uid } = await signInWithEmail(SEED_USERS.customer.email, SEED_PASSWORD);
    const before = await getUserProfile(uid);

    await expect(
      updateUserProfile(uid, { displayName: 'No Llega', phone: null }, 0),
    ).rejects.toBeInstanceOf(OfflineError);

    // The attempt that was abandoned is not carried out behind the screen's back.
    await new Promise((resolve) => setTimeout(resolve, 1_500));
    expect((await getUserProfile(uid))?.displayName).toBe(before?.displayName);
  });

  it('cannot read, create or edit the profile of another account', async () => {
    await signInWithEmail(SEED_USERS.customer.email, SEED_PASSWORD);
    const other = SEED_USERS.ownerA.uid;
    const intruder = { displayName: 'Intruso', phone: null };

    await expect(getUserProfile(other)).rejects.toBeInstanceOf(PermissionDeniedError);
    await expect(updateUserProfile(other, intruder)).rejects.toBeInstanceOf(PermissionDeniedError);
    await expect(
      createUserProfile('uid-libre', intruder, CURRENT_LEGAL_VERSIONS),
    ).rejects.toBeInstanceOf(PermissionDeniedError);
  });
});

// PLAN 2.11: the acceptance as proof — only what is pending is renewed, and nothing is lost.
describe('acceptLegalVersions', () => {
  const OLD_VERSION = '0.0';
  const LONG_AGO = new Date('2026-03-01T12:00:00Z');
  const behindInPrivacy = { from: PRIVACY_VERSION, to: OLD_VERSION, at: LONG_AGO };
  const behindInTerms = { from: TERMS_VERSION, to: OLD_VERSION, at: LONG_AGO };

  it('renews only the text that is pending and leaves the date of the other alone', async () => {
    const { uid } = await signInWithEmail(SEED_USERS.ownerB.email, SEED_PASSWORD);
    await rewindAcceptance(uid, 'privacy', behindInPrivacy);
    const before = await getUserProfile(uid);
    const started = Date.now();

    await acceptLegalVersions(uid, CURRENT_LEGAL_VERSIONS);

    const after = await getUserProfile(uid);
    expect(before?.privacy).toEqual({ version: OLD_VERSION, acceptedAt: LONG_AGO });
    expect(after?.terms).toEqual(before?.terms);
    expect(after?.privacy?.version).toBe(PRIVACY_VERSION);
    expect(after?.privacy?.acceptedAt.getTime()).toBeGreaterThan(started - CLOCK_SLACK_MS);
    expect(after).toMatchObject({
      displayName: SEED_USERS.ownerB.displayName,
      ownedDistributorIds: before?.ownedDistributorIds,
    });
  });

  it('adds the new version to the history and keeps the entry of the one before', async () => {
    const { uid } = await signInWithEmail(SEED_USERS.ownerC.email, SEED_PASSWORD);
    await rewindAcceptance(uid, 'terms', behindInTerms);

    await acceptLegalVersions(uid, CURRENT_LEGAL_VERSIONS);

    const profile = await getUserProfile(uid);
    const history = await listLegalAcceptances(uid);
    expect(history[0]).toEqual({
      id: `terms-${TERMS_VERSION}`,
      document: 'terms',
      ...profile?.terms,
    });
    expect(history).toContainEqual({
      id: `terms-${OLD_VERSION}`,
      document: 'terms',
      version: OLD_VERSION,
      acceptedAt: LONG_AGO,
    });
    expect(history).toContainEqual({
      id: `privacy-${PRIVACY_VERSION}`,
      document: 'privacy',
      ...profile?.privacy,
    });
    expect(history).toHaveLength(3);
  });

  it('renews both texts in one go when both are behind', async () => {
    const { uid } = await signInWithEmail(SEED_USERS.driverB.email, SEED_PASSWORD);
    await rewindAcceptance(uid, 'terms', behindInTerms);
    await rewindAcceptance(uid, 'privacy', behindInPrivacy);

    await acceptLegalVersions(uid, CURRENT_LEGAL_VERSIONS);

    const after = await getUserProfile(uid);
    expect(after).toMatchObject({
      terms: { version: TERMS_VERSION },
      privacy: { version: PRIVACY_VERSION },
    });
    expect(after?.privacy?.acceptedAt).toEqual(after?.terms?.acceptedAt);
    expect(await listLegalAcceptances(uid)).toHaveLength(4);
  });

  it('writes nothing for an account that already holds those versions', async () => {
    const { uid } = await signInWithEmail(SEED_USERS.dispatcherB.email, SEED_PASSWORD);
    const before = await getUserProfile(uid);
    const historyBefore = await listLegalAcceptances(uid);

    await acceptLegalVersions(uid, CURRENT_LEGAL_VERSIONS);

    expect(await getUserProfile(uid)).toEqual(before);
    expect(await listLegalAcceptances(uid)).toEqual(historyBefore);
  });

  it('refuses a version that does not exist and stores nothing, history included', async () => {
    const { uid } = await signInWithEmail(SEED_USERS.dispatcherB.email, SEED_PASSWORD);
    const before = await getUserProfile(uid);
    const unknown = { ...CURRENT_LEGAL_VERSIONS, privacyVersion: '9.9' };

    await expect(acceptLegalVersions(uid, unknown)).rejects.toBeInstanceOf(PermissionDeniedError);

    expect(await getUserProfile(uid)).toEqual(before);
    expect((await listLegalAcceptances(uid)).map((entry) => entry.version)).not.toContain('9.9');
  });

  it('refuses an account that has no profile', async () => {
    const { uid } = await registerWithEmail({
      email: 'acepta-sin-perfil@example.com',
      password: SEED_PASSWORD,
    });

    await expect(acceptLegalVersions(uid, CURRENT_LEGAL_VERSIONS)).rejects.toBeInstanceOf(
      ProfileRequiredError,
    );
    expect(await getUserProfile(uid)).toBeNull();
  });

  it('gives up with OfflineError past its deadline and accepts nothing afterwards', async () => {
    const { uid } = await signInWithEmail(SEED_USERS.ownerD.email, SEED_PASSWORD);
    await rewindAcceptance(uid, 'privacy', behindInPrivacy);

    await expect(acceptLegalVersions(uid, CURRENT_LEGAL_VERSIONS, 0)).rejects.toBeInstanceOf(
      OfflineError,
    );

    await new Promise((resolve) => setTimeout(resolve, 1_500));
    expect((await getUserProfile(uid))?.privacy?.version).toBe(OLD_VERSION);
  });

  it('lets a platform admin read the history of an account, and no other account', async () => {
    const target = SEED_USERS.ownerA.uid;

    await signInWithEmail(SEED_USERS.admin.email, SEED_PASSWORD);
    const seenByAdmin = await listLegalAcceptances(target);
    await signInWithEmail(SEED_USERS.customer.email, SEED_PASSWORD);

    expect(seenByAdmin.map((entry) => entry.document).toSorted()).toEqual(['privacy', 'terms']);
    await expect(listLegalAcceptances(target)).rejects.toBeInstanceOf(PermissionDeniedError);
  });
});

describe('addresses', () => {
  it('adds, lists, edits and deletes addresses of the account', async () => {
    const { uid } = await signInWithEmail(SEED_USERS.dispatcherA.email, SEED_PASSWORD);

    const first = await addAddress(uid, HOME);
    const second = await addAddress(uid, { ...HOME, label: 'Trabajo' });
    await updateAddress(uid, first, { ...HOME, label: 'Casa de familia' });
    await deleteAddress(uid, second);

    const stored = await listAddresses(uid);
    expect([first, second]).toEqual(['a0', 'a1']);
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      id: 'a0',
      label: 'Casa de familia',
      location: HOME.location,
    });
  });

  it('stops at the address limit and reuses a freed slot', async () => {
    const { uid } = await signInWithEmail(SEED_USERS.driverA.email, SEED_PASSWORD);
    await ADDRESS_SLOT_IDS.reduce(
      (previous) => previous.then(() => addAddress(uid, HOME)),
      Promise.resolve(''),
    );

    await expect(addAddress(uid, HOME)).rejects.toBeInstanceOf(AddressLimitError);
    await deleteAddress(uid, 'a4');
    const reused = await addAddress(uid, HOME);

    expect(reused).toBe('a4');
    expect(await listAddresses(uid)).toHaveLength(MAX_ADDRESSES_PER_USER);
  });

  it('cannot list or edit addresses of another account', async () => {
    await signInWithEmail(SEED_USERS.customer.email, SEED_PASSWORD);
    const other = SEED_USERS.driverA.uid;

    await expect(listAddresses(other)).rejects.toBeInstanceOf(PermissionDeniedError);
    await expect(updateAddress(other, 'a0', HOME)).rejects.toBeInstanceOf(PermissionDeniedError);
  });
});

describe('platform admin flag', () => {
  it('is true only for the seeded admin', async () => {
    const admin = await signInWithEmail(SEED_USERS.admin.email, SEED_PASSWORD);
    expect(await isPlatformAdmin(admin.uid)).toBe(true);

    const customer = await signInWithEmail(SEED_USERS.customer.email, SEED_PASSWORD);
    expect(await isPlatformAdmin(customer.uid)).toBe(false);
  });
});
