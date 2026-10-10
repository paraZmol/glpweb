import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SEED_CUSTOMER_LOCATION, SEED_PASSWORD, SEED_USERS } from '../../tests/seed/data';
import { seedEmulators } from '../../tests/seed/seed';
import { TERMS_VERSION } from '../domain/legal/versions';
import { ADDRESS_SLOT_IDS } from '../domain/tenancy/account-input';
import { MAX_ADDRESSES_PER_USER } from '../domain/tenancy/constants';
import { AddressLimitError, PermissionDeniedError } from '../domain/tenancy/errors';
import { registerWithEmail, signInWithEmail, signOutSession } from './auth-repo';
import { isPlatformAdmin } from './platform-repo';
import {
  acceptTerms,
  addAddress,
  createUserProfile,
  deleteAddress,
  getUserProfile,
  listAddresses,
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
  it('creates the profile with the acceptance of the terms, stamped by the server', async () => {
    const session = await signInWithEmail(SEED_USERS.noProfile.email, SEED_PASSWORD);
    const before = Date.now();

    expect(await getUserProfile(session.uid)).toBeNull();
    await createUserProfile(
      session.uid,
      { displayName: 'L. Reciente', phone: null },
      TERMS_VERSION,
    );

    const created = await getUserProfile(session.uid);
    expect(created).toMatchObject({
      displayName: 'L. Reciente',
      phone: null,
      ownedDistributorIds: [],
      terms: { version: TERMS_VERSION },
    });
    expect(created?.terms?.acceptedAt.getTime()).toBeGreaterThan(before - CLOCK_SLACK_MS);
  });

  it('refuses a profile that accepts a version of the terms that does not exist', async () => {
    const session = await registerWithEmail({
      email: 'perfil-nuevo@example.com',
      password: SEED_PASSWORD,
      displayName: 'M. Perfil',
    });
    const profile = { displayName: 'M. Perfil', phone: null };

    await expect(createUserProfile(session.uid, profile, '9.9')).rejects.toBeInstanceOf(
      PermissionDeniedError,
    );
    expect(await getUserProfile(session.uid)).toBeNull();
  });

  it('renews the acceptance without touching the rest of the profile', async () => {
    const { uid } = await signInWithEmail(SEED_USERS.dispatcherB.email, SEED_PASSWORD);
    const seededAt = (await getUserProfile(uid))?.terms?.acceptedAt.getTime() ?? 0;

    await acceptTerms(uid, TERMS_VERSION);

    const renewed = await getUserProfile(uid);
    expect(renewed?.terms?.acceptedAt.getTime()).toBeGreaterThan(seededAt);
    expect(renewed?.displayName).toBe(SEED_USERS.dispatcherB.displayName);
    await expect(acceptTerms(uid, '9.9')).rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it('updates the name and the phone', async () => {
    const { uid } = await signInWithEmail(SEED_USERS.customer.email, SEED_PASSWORD);

    await updateUserProfile(uid, { displayName: 'I. Cliente Editado', phone: '900000052' });

    expect(await getUserProfile(uid)).toMatchObject({
      displayName: 'I. Cliente Editado',
      phone: '900000052',
    });
  });

  it('cannot read, create or edit the profile of another account', async () => {
    await signInWithEmail(SEED_USERS.customer.email, SEED_PASSWORD);
    const other = SEED_USERS.ownerA.uid;
    const intruder = { displayName: 'Intruso', phone: null };

    await expect(getUserProfile(other)).rejects.toBeInstanceOf(PermissionDeniedError);
    await expect(updateUserProfile(other, intruder)).rejects.toBeInstanceOf(PermissionDeniedError);
    await expect(createUserProfile('uid-libre', intruder, TERMS_VERSION)).rejects.toBeInstanceOf(
      PermissionDeniedError,
    );
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
