import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { SEED_DISTRIBUTORS, SEED_USERS } from '../../tests/seed/data';
import { seedEmulators } from '../../tests/seed/seed';
import { NEVER_SEEN } from '../../tests/support/approve-as-seen';
import { signInAs } from '../../tests/support/emulated-session';
import { PermissionDeniedError, StaleReviewError } from '../domain/tenancy/errors';
import type { ReviewVersion } from '../domain/tenancy/review-version';
import { signOutSession } from './auth-repo';
import {
  getDistributor,
  getDistributorControl,
  type LiveStaffDistributor,
  updateDistributorProfile,
  updateVerificationData,
  watchStaffDistributor,
} from './distributors-repo';
import {
  approveListing,
  getListingReview,
  type ListingReview,
  returnListingToReview,
  watchListingReview,
} from './platform-repo';

const { a: A, b: B, e: PENDING } = SEED_DISTRIBUTORS;
const ADMIN = SEED_USERS.admin;
const OWNER = SEED_USERS.ownerE;
const NOTE = 'El RUC no coincide con la razón social.';

/** What the admin has on screen: the version of the listing read as the admin. */
async function versionSeenByAdmin(d: string): Promise<ReviewVersion> {
  await signInAs(ADMIN);
  const review = await getListingReview(d);
  if (!review) throw new Error(`No review for ${d}`);
  return review.version;
}

const approve = (d: string, seen: ReviewVersion) =>
  approveListing({ d, adminUid: ADMIN.uid, seen, now: new Date() });

type Watch<T> = (onChange: (value: T) => void, onError: (error: unknown) => void) => () => void;

/** Starts a listener and keeps everything it reports, in order. */
function collect<T>(watch: Watch<T>) {
  const values: T[] = [];
  const errors: unknown[] = [];
  const stop = watch(
    (value) => values.push(value),
    (error) => errors.push(error),
  );
  const next = (matches: (value: T) => boolean) =>
    vi.waitFor(() => {
      const found = values.find(matches);
      if (found === undefined) throw new Error('Not reported yet');
      return found;
    });
  return { values, errors, stop, next };
}

beforeAll(async () => {
  await seedEmulators();
});

afterAll(async () => {
  await signOutSession();
});

// PLAN 2.11 (role-walker): an approval is for the data the admin looked at, and for no other.
describe('approving a listing as it was seen', () => {
  it('refuses the approval when the owner changed the name after the review was opened', async () => {
    const seen = await versionSeenByAdmin(PENDING.id);
    await signInAs(OWNER);
    await updateDistributorProfile(PENDING.id, { name: 'Gas Demo Cambiada' });

    await signInAs(ADMIN);
    await expect(approve(PENDING.id, seen)).rejects.toBeInstanceOf(StaleReviewError);

    expect((await getDistributorControl(PENDING.id))?.listingApproved).toBe(false);
    expect(await getDistributor(PENDING.id)).toMatchObject({
      name: 'Gas Demo Cambiada',
      acceptingOrders: false,
    });
  });

  it('refuses it when the owner changed the verification data instead', async () => {
    const seen = await versionSeenByAdmin(PENDING.id);
    await signInAs(OWNER);
    await updateVerificationData(PENDING.id, {
      taxId: '20000000001',
      legalName: 'Gas Demo Cambiada S.A.C.',
      hydrocarbonsRegistry: '00000-074-000055',
    });

    await signInAs(ADMIN);
    await expect(approve(PENDING.id, seen)).rejects.toBeInstanceOf(StaleReviewError);

    expect((await getDistributorControl(PENDING.id))?.listingApproved).toBe(false);
  });

  it('refuses an approval that names no version the listing was ever at', async () => {
    await signInAs(ADMIN);

    await expect(approve(PENDING.id, NEVER_SEEN)).rejects.toBeInstanceOf(StaleReviewError);
  });

  it('gives each edit a version of its own', async () => {
    const before = await versionSeenByAdmin(PENDING.id);
    await signInAs(OWNER);
    await updateDistributorProfile(PENDING.id, { addressLine: 'Av. Ensayo 702' });

    const after = await versionSeenByAdmin(PENDING.id);

    expect(after.profile).not.toBe(before.profile);
    expect(after.settings).toBe(before.settings);
  });

  it('approves once the admin has the new data in front of it', async () => {
    const seen = await versionSeenByAdmin(PENDING.id);

    expect(await approve(PENDING.id, seen)).toBe(true);

    expect(await getDistributorControl(PENDING.id)).toMatchObject({
      listingApproved: true,
      approvedBy: ADMIN.uid,
    });
    expect((await getDistributor(PENDING.id))?.acceptingOrders).toBe(true);
  });

  it('leaves another distributor out of it: an edit of B does not stale the review of A', async () => {
    await signInAs(ADMIN);
    await returnListingToReview(A.id, '');
    const seen = await versionSeenByAdmin(A.id);
    await signInAs(SEED_USERS.ownerB);
    await updateDistributorProfile(B.id, { coverageRadiusKm: 9 });

    await signInAs(ADMIN);

    expect(await approve(A.id, seen)).toBe(true);
  });
});

describe('review of a listing, live', () => {
  it('reports the review now and again when a document of it changes', async () => {
    await signInAs(ADMIN);
    const first = await getListingReview(A.id);
    const watching = collect<ListingReview | null>((onChange, onError) =>
      watchListingReview(A.id, onChange, onError),
    );

    const opened = await watching.next((review) => review !== null);
    await returnListingToReview(A.id, NOTE);
    const changed = await watching.next((review) => review?.control.reviewNote === NOTE);
    watching.stop();

    expect(opened?.version).toEqual(first?.version);
    expect(changed?.control.listingApproved).toBe(false);
    // The public document was written by the same batch: it is at another version now.
    expect(changed?.version.profile).not.toBe(first?.version.profile);
    expect(changed?.version).toEqual((await getListingReview(A.id))?.version);
    expect(watching.errors).toEqual([]);
  });

  it('never reports a write the server has not confirmed', async () => {
    await signInAs(ADMIN);
    const before = (await getListingReview(A.id))?.version.profile;
    const watching = collect<ListingReview | null>((onChange, onError) =>
      watchListingReview(A.id, onChange, onError),
    );
    await watching.next((review) => review !== null);

    await returnListingToReview(A.id, 'Otra nota.');
    const after = (await getListingReview(A.id))?.version.profile;
    await watching.next((review) => review?.version.profile === after);
    watching.stop();

    // A local guess of the server time would show as a version that was never stored.
    const reported = new Set(watching.values.map((review) => review?.version.profile));
    expect(after).not.toBe(before);
    expect([...reported].sort()).toEqual([before, after].sort());
  });

  it('reports nothing more once it is stopped', async () => {
    await signInAs(ADMIN);
    const watching = collect<ListingReview | null>((onChange, onError) =>
      watchListingReview(A.id, onChange, onError),
    );
    await watching.next((review) => review !== null);
    watching.stop();
    const reported = watching.values.length;

    await returnListingToReview(A.id, 'Después de cerrar.');
    await getListingReview(A.id);

    expect(watching.values).toHaveLength(reported);
  });

  it('reports null for a distributor that does not exist', async () => {
    await signInAs(ADMIN);
    const watching = collect<ListingReview | null>((onChange, onError) =>
      watchListingReview('no-existe', onChange, onError),
    );

    await vi.waitFor(() => expect(watching.values).toContain(null));
    watching.stop();
  });

  it.each([
    ['a customer', SEED_USERS.customer],
    ['the owner of another distributor', SEED_USERS.ownerB],
  ])('fails for %s, and reports the failure once', async (_who, user) => {
    await signInAs(user);
    const watching = collect<ListingReview | null>((onChange, onError) =>
      watchListingReview(PENDING.id, onChange, onError),
    );

    await vi.waitFor(() => expect(watching.errors).toHaveLength(1));
    watching.stop();

    expect(watching.errors[0]).toBeInstanceOf(PermissionDeniedError);
    expect(watching.values).toEqual([]);
  });
});

describe('distributor of the staff, live', () => {
  it('reports the distributor with the member document of the account', async () => {
    const session = await signInAs(SEED_USERS.dispatcherA);
    const watching = collect<LiveStaffDistributor | null>((onChange, onError) =>
      watchStaffDistributor(A.id, session.uid, onChange, onError),
    );

    const live = await watching.next((value) => value !== null);
    watching.stop();

    expect(live?.distributor).toMatchObject({ id: A.id, ownerUid: SEED_USERS.ownerA.uid });
    expect(live?.member).toMatchObject({ uid: session.uid, role: 'dispatcher', active: true });
  });

  it('reports an edit of the public profile and what it did to the listing', async () => {
    const session = await signInAs(SEED_USERS.ownerB);
    const watching = collect<LiveStaffDistributor | null>((onChange, onError) =>
      watchStaffDistributor(B.id, session.uid, onChange, onError),
    );
    await watching.next((value) => value?.distributor.listingApproved === true);

    await updateDistributorProfile(B.id, { name: 'Gas Demo Sur Renombrada' });
    const settled = await watching.next(
      (value) =>
        value?.distributor.name === 'Gas Demo Sur Renombrada' &&
        value.distributor.listingApproved === false,
    );
    watching.stop();

    expect(settled?.distributor.acceptingOrders).toBe(false);
    expect(watching.errors).toEqual([]);
  });

  it.each([
    ['a customer', SEED_USERS.customer],
    ['the owner of another distributor', SEED_USERS.ownerB],
  ])('fails for %s on a distributor that is not theirs', async (_who, user) => {
    const session = await signInAs(user);
    const watching = collect<LiveStaffDistributor | null>((onChange, onError) =>
      watchStaffDistributor(PENDING.id, session.uid, onChange, onError),
    );

    await vi.waitFor(() => expect(watching.errors).toHaveLength(1));
    watching.stop();

    expect(watching.errors[0]).toBeInstanceOf(PermissionDeniedError);
    expect(watching.values).toEqual([]);
  });
});
