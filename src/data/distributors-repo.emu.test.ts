import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  SEED_CUSTOMER_LOCATION,
  SEED_DISTRIBUTORS,
  SEED_PASSWORD,
  SEED_USERS,
  type SeedUser,
} from '../../tests/seed/data';
import { seedEmulators } from '../../tests/seed/seed';
import { markEmailVerified } from '../../tests/support/emulator';
import { TERMS_VERSION } from '../domain/legal/versions';
import { MAX_DISTRIBUTORS_PER_ACCOUNT, TRIAL_DAYS } from '../domain/tenancy/constants';
import { type NewDistributor, prepareNewDistributor } from '../domain/tenancy/distributor-input';
import {
  DistributorLimitError,
  PermissionDeniedError,
  ProfileRequiredError,
  SlugTakenError,
} from '../domain/tenancy/errors';
import { findNearbyDistributors } from '../domain/tenancy/nearby';
import { isWritable, trialDaysLeft } from '../domain/tenancy/status';
import { refreshSession, registerWithEmail, signInWithEmail, signOutSession } from './auth-repo';
import {
  createDistributor,
  getDistributor,
  getDistributorBySlug,
  getDistributorPrivateSettings,
  isSlugAvailable,
  listMyMemberships,
  listVisibleDistributors,
  updateDistributorProfile,
} from './distributors-repo';
import { createUserProfile, getUserProfile } from './users-repo';

const { a: A, b: B, c: SUSPENDED, d: EXPIRED } = SEED_DISTRIBUTORS;

function newDistributor(slug: string): NewDistributor {
  const prepared = prepareNewDistributor({
    name: 'Gas Demo Nueva',
    slug,
    contactPhone: '900000091',
    addressLine: 'Av. Nueva 500',
    plant: { lat: -12.06, lng: -77.05 },
    ownerName: 'N. Fundadora',
    ownerPhone: '900000092',
  });
  if (!prepared.ok) throw new Error('The test fixture should be valid');
  return prepared.value;
}

const signInAs = (user: SeedUser) => signInWithEmail(user.email, SEED_PASSWORD);

/** A fresh, verified account with a profile: what a real founder has by the time it gets here. */
async function freshFounder(key: string) {
  const email = `${key}@example.com`;
  const session = await registerWithEmail({ email, password: SEED_PASSWORD, displayName: key });
  await markEmailVerified(session.uid);
  await refreshSession();
  await createUserProfile(session.uid, { displayName: 'N. Fundadora', phone: null }, TERMS_VERSION);
  return { uid: session.uid, email };
}

const found = (founder: { uid: string; email: string }, slug: string, now = new Date()) =>
  createDistributor({
    founder,
    distributor: newDistributor(slug),
    now,
    termsVersion: TERMS_VERSION,
  });

beforeAll(async () => {
  await seedEmulators();
});

afterAll(async () => {
  await signOutSession();
});

// PLAN 2.2
describe('createDistributor', () => {
  it('founds a distributor on trial with its slug, owner member and private settings', async () => {
    const founder = await freshFounder('fundadora-uno');
    const now = new Date();

    const id = await found(founder, 'gas-demo-nueva', now);

    const distributor = await getDistributorBySlug('gas-demo-nueva');
    expect(distributor).toMatchObject({ id, status: 'trial', ownerUid: founder.uid, brands: [] });
    expect(distributor && isWritable(distributor, now)).toBe(true);
    expect(distributor && trialDaysLeft(distributor, now)).toBe(TRIAL_DAYS);
    expect(await listMyMemberships(founder.uid)).toMatchObject([
      { uid: founder.uid, distributorId: id, role: 'owner', active: true },
    ]);
    expect(await getDistributorPrivateSettings(id)).toMatchObject({
      ownerUid: founder.uid,
      ownerEmail: founder.email,
      ownerPhone: '900000092',
      plan: 'trial',
      terms: { version: TERMS_VERSION, acceptedAt: expect.any(Date) },
      authorityDeclaredAt: expect.any(Date),
    });
    expect((await getUserProfile(founder.uid))?.ownedDistributorIds).toEqual([id]);
  });

  it('refuses a slug that another distributor already uses', async () => {
    const founder = await freshFounder('fundadora-dos');

    await expect(found(founder, A.slug)).rejects.toBeInstanceOf(SlugTakenError);

    expect(await listMyMemberships(founder.uid)).toEqual([]);
    expect((await getUserProfile(founder.uid))?.ownedDistributorIds).toEqual([]);
  });

  it('lets exactly one of two simultaneous foundings keep the slug', async () => {
    const founder = await freshFounder('fundadora-tres');

    const outcomes = await Promise.allSettled([
      found(founder, 'gas-demo-carrera'),
      found(founder, 'gas-demo-carrera'),
    ]);

    const won = outcomes.filter((outcome) => outcome.status === 'fulfilled');
    const lost = outcomes.filter((outcome) => outcome.status === 'rejected');
    expect(won).toHaveLength(1);
    expect(lost.map((outcome) => outcome.reason)).toEqual([expect.any(SlugTakenError)]);
    expect(await listMyMemberships(founder.uid)).toHaveLength(1);
  });

  it('refuses an account whose e-mail is not verified', async () => {
    const session = await signInAs(SEED_USERS.unverified);
    const founder = { uid: session.uid, email: SEED_USERS.unverified.email };

    await expect(found(founder, 'gas-demo-sin-verificar')).rejects.toBeInstanceOf(
      PermissionDeniedError,
    );
    expect(await isSlugAvailable('gas-demo-sin-verificar')).toBe(true);
  });

  it('refuses an account without a profile', async () => {
    const session = await registerWithEmail({
      email: 'aun-sin-perfil@example.com',
      password: SEED_PASSWORD,
      displayName: 'O. Sin Perfil',
    });
    await markEmailVerified(session.uid);
    await refreshSession();
    const founder = { uid: session.uid, email: 'aun-sin-perfil@example.com' };

    await expect(found(founder, 'gas-demo-sin-perfil')).rejects.toBeInstanceOf(
      ProfileRequiredError,
    );
  });

  it('refuses founding in the name of another account', async () => {
    await signInAs(SEED_USERS.customer);
    const victim = { uid: SEED_USERS.ownerA.uid, email: SEED_USERS.ownerA.email };

    await expect(found(victim, 'gas-demo-suplantada')).rejects.toBeInstanceOf(
      PermissionDeniedError,
    );
  });

  it('stops at the limit of distributors per account', async () => {
    const founder = await freshFounder('fundadora-cuatro');
    const slugs = Array.from({ length: MAX_DISTRIBUTORS_PER_ACCOUNT }, (_, i) => `gas-tope-${i}`);
    await slugs.reduce(
      (previous, slug) => previous.then(() => found(founder, slug)),
      Promise.resolve(''),
    );

    await expect(found(founder, 'gas-tope-extra')).rejects.toBeInstanceOf(DistributorLimitError);
    expect(await isSlugAvailable('gas-tope-extra')).toBe(true);
  });
});

// PLAN 2.5
describe('getDistributorBySlug', () => {
  it('resolves a public page without a session', async () => {
    await signOutSession();

    expect(await getDistributorBySlug(A.slug)).toMatchObject({ id: A.id, name: A.name });
  });

  it('still resolves a suspended distributor so the page can say it is unavailable', async () => {
    const suspended = await getDistributorBySlug(SUSPENDED.slug);

    expect(suspended?.status).toBe('suspended');
    expect(suspended && isWritable(suspended, new Date())).toBe(false);
  });

  it('returns null for an unknown slug', async () => {
    expect(await getDistributorBySlug('no-existe')).toBeNull();
    expect(await getDistributor('no-existe')).toBeNull();
  });
});

// PLAN 2.6
describe('listVisibleDistributors', () => {
  it('lists trial and active distributors, never a suspended one, without a session', async () => {
    await signOutSession();

    const ids = (await listVisibleDistributors()).map((distributor) => distributor.id);

    expect(ids).toEqual(expect.arrayContaining([A.id, B.id, EXPIRED.id]));
    expect(ids).not.toContain(SUSPENDED.id);
  });

  it('honours a smaller limit', async () => {
    expect(await listVisibleDistributors({ limit: 1 })).toHaveLength(1);
  });

  it('feeds the search: only the seeded distributors that reach the customer, nearest first', async () => {
    const seeded = (await listVisibleDistributors()).filter((d) => d.id.startsWith('seed-'));

    const nearby = findNearbyDistributors(seeded, SEED_CUSTOMER_LOCATION, new Date());

    expect(nearby.map((entry) => entry.distributor.id)).toEqual([A.id, B.id]);
    expect(nearby[0]?.distributor).toMatchObject({ brands: A.brands, priceFromCents: 3800 });
  });
});

describe('updateDistributorProfile', () => {
  const edit = { name: 'Gas Demo Editada', coverageRadiusKm: 6 };

  it('lets the owner edit the public profile', async () => {
    await signInAs(SEED_USERS.ownerB);

    await updateDistributorProfile(B.id, {
      ...edit,
      plant: { lat: -12.08, lng: -77.03 },
      schedule: { days: [1, 2, 3, 4, 5, 6], opensAt: '06:30', closesAt: '21:00' },
    });

    expect(await getDistributor(B.id)).toMatchObject({
      ...edit,
      plant: { lat: -12.08, lng: -77.03 },
      schedule: { opensAt: '06:30', closesAt: '21:00' },
      status: 'active',
    });
  });

  it.each([
    ['the owner of a suspended distributor', SEED_USERS.ownerC, SUSPENDED.id],
    ['the owner of a distributor whose trial ended', SEED_USERS.ownerD, EXPIRED.id],
    ['a driver of the distributor', SEED_USERS.driverA, A.id],
    ['a dispatcher of the distributor', SEED_USERS.dispatcherA, A.id],
    ['the owner of another distributor', SEED_USERS.ownerB, A.id],
    ['a customer', SEED_USERS.customer, A.id],
  ])('refuses %s', async (_who, user, distributorId) => {
    await signInAs(user);

    await expect(updateDistributorProfile(distributorId, edit)).rejects.toBeInstanceOf(
      PermissionDeniedError,
    );
  });
});

describe('listMyMemberships and private settings', () => {
  it('returns the membership of each seeded role', async () => {
    const session = await signInAs(SEED_USERS.driverA);

    expect(await listMyMemberships(session.uid)).toMatchObject([
      { distributorId: A.id, role: 'driver', active: true },
    ]);
  });

  it('returns nothing for a customer', async () => {
    const session = await signInAs(SEED_USERS.customer);

    expect(await listMyMemberships(session.uid)).toEqual([]);
  });

  it('refuses asking for the memberships of someone else', async () => {
    await signInAs(SEED_USERS.customer);

    await expect(listMyMemberships(SEED_USERS.ownerA.uid)).rejects.toBeInstanceOf(
      PermissionDeniedError,
    );
  });

  it('keeps the private settings away from the staff and from other owners', async () => {
    await signInAs(SEED_USERS.dispatcherA);
    await expect(getDistributorPrivateSettings(A.id)).rejects.toBeInstanceOf(PermissionDeniedError);

    await signInAs(SEED_USERS.ownerB);
    await expect(getDistributorPrivateSettings(A.id)).rejects.toBeInstanceOf(PermissionDeniedError);

    await signInAs(SEED_USERS.ownerA);
    expect(await getDistributorPrivateSettings(A.id)).toMatchObject({
      ownerEmail: SEED_USERS.ownerA.email,
    });
  });
});
