import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  SEED_CUSTOMER_LOCATION,
  SEED_DISTRIBUTORS,
  SEED_PASSWORD,
  SEED_USERS,
  type SeedUser,
} from '../../tests/seed/data';
import { seedEmulators } from '../../tests/seed/seed';
import { approveAsSeen } from '../../tests/support/approve-as-seen';
import { markEmailVerified } from '../../tests/support/emulator';
import { CURRENT_LEGAL_VERSIONS, TERMS_VERSION } from '../domain/legal/versions';
import { MAX_DISTRIBUTORS_PER_ACCOUNT, TRIAL_DAYS } from '../domain/tenancy/constants';
import { type NewDistributor, prepareNewDistributor } from '../domain/tenancy/distributor-input';
import {
  DistributorLimitError,
  FoundingBlockedError,
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
  getDistributorControl,
  getDistributorPrivateSettings,
  getStaffDistributor,
  isSlugAvailable,
  listMyMemberships,
  listVisibleDistributors,
  syncAcceptingOrders,
  syncMemberDistributorName,
  updateDistributorProfile,
  updateVerificationData,
} from './distributors-repo';
import { setDistributorStatus } from './platform-repo';
import { createUserProfile, getUserProfile } from './users-repo';

const { a: A, b: B, c: SUSPENDED, d: EXPIRED, e: PENDING } = SEED_DISTRIBUTORS;

const VERIFICATION = {
  taxId: '20000000001',
  legalName: 'Gas Demo Nueva S.A.C.',
  hydrocarbonsRegistry: '00000-074-000009',
};

function newDistributor(slug: string): NewDistributor {
  const prepared = prepareNewDistributor({
    name: 'Gas Demo Nueva',
    slug,
    contactPhone: '900000091',
    addressLine: 'Av. Nueva 500',
    plant: { lat: -12.06, lng: -77.05 },
    ownerName: 'N. Fundadora',
    ownerPhone: '900000092',
    ...VERIFICATION,
  });
  if (!prepared.ok) throw new Error('The test fixture should be valid');
  return prepared.value;
}

const signInAs = (user: SeedUser) => signInWithEmail(user.email, SEED_PASSWORD);

/** A fresh, verified account with a profile: what a real founder has by the time it gets here. */
async function freshFounder(key: string) {
  const email = `${key}@example.com`;
  const session = await registerWithEmail({ email, password: SEED_PASSWORD });
  await markEmailVerified(session.uid);
  await refreshSession();
  const profile = { displayName: 'N. Fundadora', phone: null };
  await createUserProfile(session.uid, profile, CURRENT_LEGAL_VERSIONS);
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

    // PLAN 2.11: born unlisted and waiting for its review; its founder still reads it.
    expect(id).toMatch(/^[A-Za-z0-9]{20}$/);
    expect(await getDistributorBySlug('gas-demo-nueva')).toMatchObject({
      id,
      acceptingOrders: false,
      brands: [],
    });
    const distributor = await getStaffDistributor(id);
    expect(distributor).toMatchObject({
      id,
      status: 'trial',
      ownerUid: founder.uid,
      listingApproved: false,
      reviewNote: null,
    });
    expect(distributor && isWritable(distributor, now)).toBe(true);
    expect(distributor && trialDaysLeft(distributor, now)).toBe(TRIAL_DAYS);
    expect(await listMyMemberships(founder.uid)).toMatchObject([
      {
        uid: founder.uid,
        distributorId: id,
        role: 'owner',
        active: true,
        distributorName: 'Gas Demo Nueva',
      },
    ]);
    expect(await getDistributorPrivateSettings(id)).toMatchObject({
      ownerUid: founder.uid,
      ownerEmail: founder.email,
      ownerPhone: '900000092',
      plan: 'trial',
      ...VERIFICATION,
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

  // PLAN 2.11 (defect found by flow-tester): two tabs of one account send its third and a
  // fourth distributor at once. The rules refuse one; it must be told about the cap, not
  // "no tienes permiso".
  it('tells the loser of a race for the last slot that the account reached its cap', async () => {
    const founder = await freshFounder('fundadora-cinco');
    await found(founder, 'gas-cupo-uno');
    await found(founder, 'gas-cupo-dos');

    const outcomes = await Promise.allSettled([
      found(founder, 'gas-cupo-tres'),
      found(founder, 'gas-cupo-cuatro'),
    ]);

    const lost = outcomes.filter((outcome) => outcome.status === 'rejected');
    expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
    expect(lost.map((outcome) => outcome.reason)).toEqual([expect.any(DistributorLimitError)]);
    const owned = (await getUserProfile(founder.uid))?.ownedDistributorIds;
    expect(owned).toHaveLength(MAX_DISTRIBUTORS_PER_ACCOUNT);
  });

  // PLAN 2.11: a read-only distributor is not escaped with thirty fresh days of trial.
  it.each([
    ['is suspended', SEED_USERS.ownerC, 'gas-demo-otra-c'],
    ['ran out of trial', SEED_USERS.ownerD, 'gas-demo-otra-d'],
  ])('refuses an account whose distributor %s', async (_case, user, slug) => {
    const session = await signInAs(user);

    await expect(found({ uid: session.uid, email: user.email }, slug)).rejects.toBeInstanceOf(
      FoundingBlockedError,
    );
    expect(await isSlugAvailable(slug)).toBe(true);
  });

  it('lets an account whose distributor only waits for its review found another', async () => {
    const session = await signInAs(SEED_USERS.ownerE);

    const id = await found({ uid: session.uid, email: SEED_USERS.ownerE.email }, 'gas-demo-otra-e');

    expect((await getUserProfile(session.uid))?.ownedDistributorIds).toEqual([PENDING.id, id]);
  });
});

// PLAN 2.5
describe('getDistributorBySlug', () => {
  it('resolves a public page without a session', async () => {
    await signOutSession();

    expect(await getDistributorBySlug(A.slug)).toMatchObject({ id: A.id, name: A.name });
  });

  // PLAN 2.11: without the approval, or once suspended or out of trial, the page hands its
  // name and its phones to nobody outside. A visitor cannot tell it from a link nobody has.
  it.each([
    ['waits for its review', PENDING],
    ['is suspended', SUSPENDED],
    ['ran out of trial', EXPIRED],
  ])('answers "not found" to a visitor and to a customer when it %s', async (_case, seeded) => {
    await signOutSession();
    expect(await getDistributorBySlug(seeded.slug)).toBeNull();
    await expect(getDistributor(seeded.id)).rejects.toBeInstanceOf(PermissionDeniedError);

    await signInAs(SEED_USERS.customer);
    expect(await getDistributorBySlug(seeded.slug)).toBeNull();
  });

  it.each([
    ['its owner', SEED_USERS.ownerE],
    ['a platform admin', SEED_USERS.admin],
  ])('still shows a distributor that waits for its review to %s', async (_who, user) => {
    await signInAs(user);

    expect(await getDistributorBySlug(PENDING.slug)).toMatchObject({
      id: PENDING.id,
      name: PENDING.name,
      acceptingOrders: false,
    });
  });

  // PLAN 2.9
  it('tells a visitor nothing about the plan of a distributor it can read', async () => {
    await signOutSession();

    const visible = await getDistributorBySlug(A.slug);

    expect(visible).not.toHaveProperty('status');
    expect(visible).not.toHaveProperty('trialEndsAt');
    expect(visible).not.toHaveProperty('ownerUid');
    expect(visible).not.toHaveProperty('listingApproved');
    await expect(getDistributorControl(A.id)).rejects.toBeInstanceOf(PermissionDeniedError);
    await expect(getStaffDistributor(A.id)).rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it('returns null for an unknown slug', async () => {
    expect(await getDistributorBySlug('no-existe')).toBeNull();
    expect(await getDistributor('no-existe')).toBeNull();
  });
});

// PLAN 2.6
describe('listVisibleDistributors', () => {
  it('lists the distributors that take orders, without a session', async () => {
    await signOutSession();

    const ids = (await listVisibleDistributors()).map((distributor) => distributor.id);

    expect(ids).toEqual(expect.arrayContaining([A.id, B.id]));
    expect(ids).not.toContain(SUSPENDED.id);
    expect(ids).not.toContain(EXPIRED.id);
    expect(ids).not.toContain(PENDING.id);
  });

  it('honours a smaller limit', async () => {
    expect(await listVisibleDistributors({ limit: 1 })).toHaveLength(1);
  });

  it('feeds the search: only the seeded distributors that reach the customer, nearest first', async () => {
    const seeded = (await listVisibleDistributors()).filter((d) => d.id.startsWith('seed-'));

    const nearby = findNearbyDistributors(seeded, SEED_CUSTOMER_LOCATION);

    expect(nearby.map((entry) => entry.distributor.id)).toEqual([A.id, B.id]);
    expect(nearby[0]?.distributor).toMatchObject({ brands: A.brands, priceFromCents: 3800 });
  });
});

describe('updateDistributorProfile', () => {
  const edit = { name: 'Gas Demo Editada', coverageRadiusKm: 6 };

  it('lets the owner edit the public profile, which stays listed', async () => {
    await signInAs(SEED_USERS.ownerB);
    const plain = {
      coverageRadiusKm: 6,
      brandColor: '#1f2937',
      schedule: { days: [1, 2, 3, 4, 5, 6], opensAt: '06:30', closesAt: '21:00' },
    };

    expect(await updateDistributorProfile(B.id, plain)).toBe(false);

    await signOutSession();
    expect(await getDistributor(B.id)).toMatchObject({
      coverageRadiusKm: 6,
      brandColor: '#1f2937',
      schedule: { opensAt: '06:30', closesAt: '21:00' },
      acceptingOrders: true,
    });
  });

  // PLAN 2.11: what identifies the business does not change under an approval.
  it.each([
    ['the contact phone', { contactPhone: '900000024' }],
    ['the WhatsApp number', { whatsapp: '900000025' }],
    // Security audit of phase 2 (M1): where the business is was approved too.
    ['the address', { addressLine: 'Av. Ensayo 705' }],
    ['where the plant is', { plant: { lat: -16.409, lng: -71.5375 } }],
  ])('sends the listing back to review when the owner changes %s', async (_case, change) => {
    await signInAs(SEED_USERS.admin);
    await approveAsSeen(B.id, SEED_USERS.admin.uid);
    await signInAs(SEED_USERS.ownerB);

    expect(await updateDistributorProfile(B.id, change)).toBe(true);

    expect(await getStaffDistributor(B.id)).toMatchObject({
      ...change,
      acceptingOrders: false,
      listingApproved: false,
    });
    expect((await getDistributorControl(B.id))?.approvedAt).toBeNull();
    await signOutSession();
    expect(await getDistributorBySlug(B.slug)).toBeNull();
    expect((await listVisibleDistributors()).map((d) => d.id)).not.toContain(B.id);
  });

  // PLAN 2.9: the selector reads the name from the membership.
  it('carries a new name to the membership of every member, and to review', async () => {
    await signInAs(SEED_USERS.ownerB);
    expect(await updateDistributorProfile(B.id, { name: 'Gas Demo Sur Renombrada' })).toBe(true);
    expect(await getStaffDistributor(B.id)).toMatchObject({
      name: 'Gas Demo Sur Renombrada',
      listingApproved: false,
    });

    for (const user of [SEED_USERS.ownerB, SEED_USERS.dispatcherB, SEED_USERS.driverB]) {
      const session = await signInAs(user);
      expect(await listMyMemberships(session.uid)).toMatchObject([
        { distributorId: B.id, distributorName: 'Gas Demo Sur Renombrada' },
      ]);
    }
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
      { distributorId: A.id, role: 'driver', active: true, distributorName: A.name },
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
      taxId: A.taxId,
      legalName: A.legalName,
      hydrocarbonsRegistry: A.hydrocarbonsRegistry,
    });
  });

  // PLAN 2.11
  it('lets the founder correct the verification data only while the listing waits', async () => {
    const corrected = {
      taxId: '20000000061',
      legalName: 'Gas Demo Corregida S.A.C.',
      hydrocarbonsRegistry: '11111-074-111111',
    };

    await signInAs(SEED_USERS.ownerE);
    await updateVerificationData(PENDING.id, corrected);
    expect(await getDistributorPrivateSettings(PENDING.id)).toMatchObject(corrected);

    await signInAs(SEED_USERS.ownerA);
    await expect(updateVerificationData(A.id, corrected)).rejects.toBeInstanceOf(
      PermissionDeniedError,
    );
  });
});

// PLAN 2.9: what only the staff may know, and how the public flag follows it.
describe('control document and the public "takes orders" flag', () => {
  it.each([
    ['the owner', SEED_USERS.ownerA],
    ['the dispatcher', SEED_USERS.dispatcherA],
    ['the driver', SEED_USERS.driverA],
  ])('shows %s the plan state of its distributor', async (_who, user) => {
    await signInAs(user);

    expect(await getStaffDistributor(A.id)).toMatchObject({
      id: A.id,
      status: 'active',
      ownerUid: SEED_USERS.ownerA.uid,
      trialEndsAt: expect.any(Date),
    });
  });

  it.each([
    ['a customer', SEED_USERS.customer],
    ['the owner of another distributor', SEED_USERS.ownerB],
  ])('keeps it from %s', async (_who, user) => {
    await signInAs(user);

    await expect(getDistributorControl(A.id)).rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it('lets the staff write the flag only as the control document says', async () => {
    await signInAs(SEED_USERS.ownerD);

    await expect(syncAcceptingOrders(EXPIRED.id, true)).rejects.toBeInstanceOf(
      PermissionDeniedError,
    );
    // It already says the truth. Writing it again would change nothing but the version of the
    // listing, which is what an approval names (security audit of phase 2, B2): refused. A real
    // correction of the flag is in firebase/tests/attack-review-integrity.rules.test.ts.
    await expect(syncAcceptingOrders(EXPIRED.id, false)).rejects.toBeInstanceOf(
      PermissionDeniedError,
    );

    expect((await getDistributor(EXPIRED.id))?.acceptingOrders).toBe(false);
  });

  it('lets a member correct only its own copy of the name, and only to the real one', async () => {
    const session = await signInAs(SEED_USERS.driverA);

    await syncMemberDistributorName(A.id, session.uid, A.name);
    await expect(
      syncMemberDistributorName(A.id, session.uid, 'Otro Nombre'),
    ).rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it('lets a platform admin suspend and reactivate, moving the search with it', async () => {
    await signInAs(SEED_USERS.admin);

    expect(await setDistributorStatus(A.id, 'suspended', new Date())).toBe(true);
    expect((await getDistributor(A.id))?.acceptingOrders).toBe(false);
    expect((await listVisibleDistributors()).map((d) => d.id)).not.toContain(A.id);

    await setDistributorStatus(A.id, 'active', new Date());
    expect((await getDistributor(A.id))?.acceptingOrders).toBe(true);
    expect(await setDistributorStatus('no-existe', 'active', new Date())).toBe(false);
  });

  it('never lists, through a status change, a distributor that is not approved', async () => {
    await signInAs(SEED_USERS.admin);

    expect(await setDistributorStatus(PENDING.id, 'active', new Date())).toBe(true);

    expect((await getDistributor(PENDING.id))?.acceptingOrders).toBe(false);
  });

  it('refuses a status change from anyone who is not a platform admin', async () => {
    await signInAs(SEED_USERS.ownerC);

    await expect(setDistributorStatus(SUSPENDED.id, 'active', new Date())).rejects.toBeInstanceOf(
      PermissionDeniedError,
    );
  });
});
