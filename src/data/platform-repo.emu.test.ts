import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SEED_DISTRIBUTORS, SEED_PASSWORD, SEED_USERS, type SeedUser } from '../../tests/seed/data';
import { seedEmulators } from '../../tests/seed/seed';
import { approveAsSeen } from '../../tests/support/approve-as-seen';
import { PermissionDeniedError } from '../domain/tenancy/errors';
import { signInWithEmail, signOutSession } from './auth-repo';
import {
  getDistributor,
  getDistributorBySlug,
  getDistributorControl,
  listVisibleDistributors,
  updateDistributorProfile,
} from './distributors-repo';
import {
  getListingReview,
  listPendingListings,
  returnListingToReview,
  setDistributorStatus,
} from './platform-repo';

const { a: A, b: B, c: SUSPENDED, e: PENDING } = SEED_DISTRIBUTORS;
const ADMIN = SEED_USERS.admin;

const signInAs = (user: SeedUser) => signInWithEmail(user.email, SEED_PASSWORD);
const visibleIds = async () =>
  (await listVisibleDistributors()).map((distributor) => distributor.id);
const pendingIds = async () => (await listPendingListings()).map((entry) => entry.distributorId);

beforeAll(async () => {
  await seedEmulators();
});

afterAll(async () => {
  await signOutSession();
});

// PLAN 2.11: the review of listings by the platform.
describe('listings that wait for review', () => {
  it('lists the distributor that was just founded, and no approved one', async () => {
    await signInAs(ADMIN);

    const pending = await listPendingListings();

    expect(pending.map((entry) => entry.distributorId)).toEqual([PENDING.id]);
    expect(pending[0]?.control).toMatchObject({
      ownerUid: SEED_USERS.ownerE.uid,
      status: 'trial',
      listingApproved: false,
      approvedAt: null,
      reviewNote: null,
    });
  });

  it('honours a smaller limit', async () => {
    await signInAs(ADMIN);

    expect(await listPendingListings({ limit: 1 })).toHaveLength(1);
  });

  it('hands the admin what was declared about the business', async () => {
    await signInAs(ADMIN);

    expect(await getListingReview(PENDING.id)).toMatchObject({
      distributorId: PENDING.id,
      profile: { name: PENDING.name, contactPhone: PENDING.contactPhone, acceptingOrders: false },
      control: { listingApproved: false },
      settings: {
        taxId: PENDING.taxId,
        legalName: PENDING.legalName,
        hydrocarbonsRegistry: PENDING.hydrocarbonsRegistry,
        ownerEmail: SEED_USERS.ownerE.email,
      },
    });
    expect(await getListingReview('no-existe')).toBeNull();
  });

  it.each([
    ['a customer', SEED_USERS.customer],
    ['the owner of the listing itself', SEED_USERS.ownerE],
    ['the owner of an approved distributor', SEED_USERS.ownerA],
  ])('keeps the list and the review from %s', async (_who, user) => {
    await signInAs(user);

    await expect(listPendingListings()).rejects.toBeInstanceOf(PermissionDeniedError);
    // The review of a distributor that is not theirs: its control and settings stay closed.
    await expect(getListingReview(B.id)).rejects.toBeInstanceOf(PermissionDeniedError);
  });
});

describe('deciding on a listing', () => {
  it('sends it back with a note the owner reads, and it stays hidden', async () => {
    await signInAs(ADMIN);
    await returnListingToReview(PENDING.id, 'El RUC no coincide con la razón social.');

    await signInAs(SEED_USERS.ownerE);
    expect((await getDistributorControl(PENDING.id))?.reviewNote).toBe(
      'El RUC no coincide con la razón social.',
    );
    await signOutSession();
    expect(await getDistributorBySlug(PENDING.slug)).toBeNull();
  });

  it('approves it: signed, without the note, visible and in the search', async () => {
    const admin = await signInAs(ADMIN);

    expect(await approveAsSeen(PENDING.id, admin.uid)).toBe(true);

    expect(await getDistributorControl(PENDING.id)).toMatchObject({
      listingApproved: true,
      approvedBy: admin.uid,
      approvedAt: expect.any(Date),
      reviewNote: null,
    });
    expect(await pendingIds()).not.toContain(PENDING.id);
    await signOutSession();
    expect(await getDistributorBySlug(PENDING.slug)).toMatchObject({
      name: PENDING.name,
      acceptingOrders: true,
    });
    expect(await visibleIds()).toContain(PENDING.id);
  });

  it('answers false for a distributor that does not exist', async () => {
    const admin = await signInAs(ADMIN);

    expect(await approveAsSeen('no-existe', admin.uid)).toBe(false);
  });

  it('withdraws an approval: the page closes and the listing waits again', async () => {
    await signInAs(ADMIN);

    await returnListingToReview(PENDING.id, '');

    expect(await getDistributorControl(PENDING.id)).toMatchObject({
      listingApproved: false,
      approvedAt: null,
      approvedBy: null,
      reviewNote: null,
    });
    expect(await pendingIds()).toContain(PENDING.id);
    await signOutSession();
    expect(await getDistributorBySlug(PENDING.slug)).toBeNull();
    expect(await visibleIds()).not.toContain(PENDING.id);
  });

  it('approves a suspended distributor without showing it', async () => {
    const admin = await signInAs(ADMIN);
    await returnListingToReview(SUSPENDED.id, '');

    expect(await approveAsSeen(SUSPENDED.id, admin.uid)).toBe(true);

    expect((await getDistributor(SUSPENDED.id))?.acceptingOrders).toBe(false);
    await signOutSession();
    expect(await getDistributorBySlug(SUSPENDED.slug)).toBeNull();
  });

  it.each([
    ['its own owner', SEED_USERS.ownerE],
    ['a customer', SEED_USERS.customer],
  ])('refuses an approval or a return from %s', async (_who, user) => {
    const session = await signInAs(user);

    await expect(approveAsSeen(PENDING.id, session.uid)).rejects.toBeInstanceOf(
      PermissionDeniedError,
    );
    await expect(approveAsSeen(PENDING.id, ADMIN.uid)).rejects.toBeInstanceOf(
      PermissionDeniedError,
    );
    await expect(returnListingToReview(A.id, 'x')).rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it('puts back in the list a distributor whose owner changed its name', async () => {
    await signInAs(SEED_USERS.ownerA);
    await updateDistributorProfile(A.id, { name: 'Gas Demo Norte Renombrada' });

    await signInAs(ADMIN);
    expect(await pendingIds()).toContain(A.id);
    const admin = await signInAs(ADMIN);
    await approveAsSeen(A.id, admin.uid);
    expect(await pendingIds()).not.toContain(A.id);
  });
});

describe('suspending and reactivating', () => {
  it('suspending hides the page, the name and the phones from visitors at once', async () => {
    await signInAs(ADMIN);
    expect(await setDistributorStatus(A.id, 'suspended', new Date())).toBe(true);

    await signOutSession();
    expect(await getDistributorBySlug(A.slug)).toBeNull();
    await expect(getDistributor(A.id)).rejects.toBeInstanceOf(PermissionDeniedError);
    expect(await visibleIds()).not.toContain(A.id);
    // Its own staff still reads it, to see why the panel is read-only.
    await signInAs(SEED_USERS.driverA);
    expect((await getDistributor(A.id))?.acceptingOrders).toBe(false);
  });

  it('reactivating shows it again, with its approval untouched', async () => {
    await signInAs(ADMIN);
    const chooseActive = () => 'active' as const;

    expect(await setDistributorStatus(A.id, chooseActive, new Date())).toBe(true);

    expect(await getDistributorControl(A.id)).toMatchObject({
      status: 'active',
      listingApproved: true,
    });
    await signOutSession();
    expect(await getDistributorBySlug(A.slug)).toMatchObject({ acceptingOrders: true });
  });
});
