import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { EMULATOR_HOST, EMULATOR_PROJECT_ID, emulatorPorts } from '../../scripts/lane-ports.mjs';
import { SEED_DISTRIBUTORS, SEED_PASSWORD, SEED_USERS, type SeedUser } from '../../tests/seed/data';
import { seedEmulators } from '../../tests/seed/seed';
import { approveAsSeen } from '../../tests/support/approve-as-seen';
import { PermissionDeniedError } from '../domain/tenancy/errors';
import { listingStateOf } from '../domain/tenancy/listing';
import { signInWithEmail, signOutSession } from './auth-repo';
import {
  getDistributorBySlug,
  getDistributorControl,
  getStaffDistributor,
  updateDistributorProfile,
  updateVerificationData,
} from './distributors-repo';
import {
  listDistributors,
  listPendingListings,
  type PageCursor,
  returnListingToReview,
  setDistributorStatus,
} from './platform-repo';

const { a: A, b: B, c: SUSPENDED, d: EXPIRED, e: PENDING } = SEED_DISTRIBUTORS;
const ADMIN = SEED_USERS.admin;
const APPROVED_IDS = [A.id, B.id, SUSPENDED.id, EXPIRED.id].sort();
const NOTE = 'El RUC no coincide con la razón social.';
const CORRECTED = {
  taxId: PENDING.taxId,
  legalName: 'Gas Demo Corregida S.A.C.',
  hydrocarbonsRegistry: PENDING.hydrocarbonsRegistry,
};

const signInAs = (user: SeedUser) => signInWithEmail(user.email, SEED_PASSWORD);
const idsOf = (items: { distributorId: string }[]) => items.map((item) => item.distributorId);

/** Writes one document past the rules, as only the emulator allows. */
async function writeAsAdmin(path: string, data: Record<string, unknown>): Promise<void> {
  const env = await initializeTestEnvironment({
    projectId: EMULATOR_PROJECT_ID,
    firestore: { host: EMULATOR_HOST, port: emulatorPorts().firestore },
  });
  try {
    await env.withSecurityRulesDisabled((context) => setDoc(doc(context.firestore(), path), data));
  } finally {
    await env.cleanup();
  }
}

beforeAll(async () => {
  await seedEmulators();
});

afterAll(async () => {
  await signOutSession();
});

// PLAN 2.11: the name and the link travel in the control document.
describe('rows of the platform lists', () => {
  it('carry the name and the link of each listing that waits', async () => {
    await signInAs(ADMIN);

    const [waiting] = await listPendingListings();

    expect(waiting).toMatchObject({
      distributorId: PENDING.id,
      control: { distributorName: PENDING.name, slug: PENDING.slug, correctedAt: null },
    });
  });

  it('follow a rename by the owner', async () => {
    await signInAs(SEED_USERS.ownerE);
    await updateDistributorProfile(PENDING.id, { name: 'Gas Demo En Revisión Dos' });

    await signInAs(ADMIN);
    const [waiting] = await listPendingListings();
    expect(waiting?.control.distributorName).toBe('Gas Demo En Revisión Dos');

    await signInAs(SEED_USERS.ownerE);
    await updateDistributorProfile(PENDING.id, { name: PENDING.name });
  });
});

// PLAN 2.11: reaching a distributor that is already approved or suspended.
describe('listDistributors', () => {
  it('lists the approved distributors, operating or not, and not the one that waits', async () => {
    await signInAs(ADMIN);

    const page = await listDistributors({ filter: 'approved' });

    expect(idsOf(page.items).sort()).toEqual(APPROVED_IDS);
    expect(page.next).toBeNull();
    expect(page.items.map((item) => item.control.distributorName).sort()).toEqual(
      [A.name, B.name, SUSPENDED.name, EXPIRED.name].sort(),
    );
  });

  it('lists only the suspended ones', async () => {
    await signInAs(ADMIN);

    const page = await listDistributors({ filter: 'suspended' });

    expect(idsOf(page.items)).toEqual([SUSPENDED.id]);
    expect(page.items[0]?.control).toMatchObject({ status: 'suspended', slug: SUSPENDED.slug });
  });

  it('lists the ones in review like the pending list does', async () => {
    await signInAs(ADMIN);

    const page = await listDistributors({ filter: 'inReview' });

    expect(idsOf(page.items)).toEqual(idsOf(await listPendingListings()));
  });

  it.each([1, 2, 3])(
    'walks the approved ones %i at a time without repeating or losing any',
    async (pageSize) => {
      await signInAs(ADMIN);
      const seen: string[] = [];
      let after: PageCursor | null = null;
      let pages = 0;

      do {
        const page = await listDistributors({ filter: 'approved', pageSize, after });
        expect(page.items.length).toBeLessThanOrEqual(pageSize);
        seen.push(...idsOf(page.items));
        after = page.next;
        pages += 1;
      } while (after !== null);

      expect([...seen].sort()).toEqual(APPROVED_IDS);
      expect(pages).toBe(Math.ceil(APPROVED_IDS.length / pageSize));
    },
  );

  it('says there is no next page when the last one is exactly full', async () => {
    await signInAs(ADMIN);

    const page = await listDistributors({ filter: 'approved', pageSize: APPROVED_IDS.length });

    expect(page.items).toHaveLength(APPROVED_IDS.length);
    expect(page.next).toBeNull();
  });

  it('never asks for more than the page size the rules allow', async () => {
    await signInAs(ADMIN);

    const page = await listDistributors({ filter: 'approved', pageSize: 5000 });

    expect(idsOf(page.items).sort()).toEqual(APPROVED_IDS);
  });

  it('moves a distributor between lists when the admin suspends and reactivates it', async () => {
    await signInAs(ADMIN);
    await setDistributorStatus(B.id, 'suspended', new Date());

    expect(idsOf((await listDistributors({ filter: 'suspended' })).items).sort()).toEqual(
      [B.id, SUSPENDED.id].sort(),
    );

    await setDistributorStatus(B.id, 'active', new Date());
    expect(idsOf((await listDistributors({ filter: 'suspended' })).items)).toEqual([SUSPENDED.id]);
  });

  it.each([
    ['a customer', SEED_USERS.customer],
    ['the owner of an approved distributor', SEED_USERS.ownerA],
    ['the owner of the suspended one', SEED_USERS.ownerC],
    ['a driver', SEED_USERS.driverA],
  ])('keeps every list from %s', async (_who, user) => {
    await signInAs(user);

    for (const filter of ['inReview', 'approved', 'suspended'] as const) {
      await expect(listDistributors({ filter })).rejects.toBeInstanceOf(PermissionDeniedError);
      await expect(listDistributors({ filter, pageSize: 1 })).rejects.toBeInstanceOf(
        PermissionDeniedError,
      );
    }
  });

  it('keeps every list from a visitor without a session', async () => {
    await signOutSession();

    await expect(listDistributors({ filter: 'approved' })).rejects.toBeInstanceOf(
      PermissionDeniedError,
    );
  });
});

// PLAN 2.11: after correcting, the listing reads "corrections sent", and nothing else changes.
describe('answering a note of the platform', () => {
  const stateOf = async (id: string) => {
    const distributor = await getStaffDistributor(id);
    return distributor && listingStateOf(distributor, new Date());
  };

  it('does not mark a correction when no note waits', async () => {
    await signInAs(SEED_USERS.ownerE);

    expect(await updateVerificationData(PENDING.id, CORRECTED)).toBe(false);

    expect((await getDistributorControl(PENDING.id))?.correctedAt).toBeNull();
    expect(await stateOf(PENDING.id)).toBe('inReview');
  });

  it('marks the correction of the verification data, keeps the note and stays hidden', async () => {
    await signInAs(ADMIN);
    await returnListingToReview(PENDING.id, NOTE);
    await signInAs(SEED_USERS.ownerE);
    expect(await stateOf(PENDING.id)).toBe('changesRequested');

    expect(await updateVerificationData(PENDING.id, CORRECTED)).toBe(true);

    expect(await getDistributorControl(PENDING.id)).toMatchObject({
      listingApproved: false,
      approvedAt: null,
      reviewNote: NOTE,
      correctedAt: expect.any(Date),
    });
    expect(await stateOf(PENDING.id)).toBe('correctionsSent');
    await signOutSession();
    expect(await getDistributorBySlug(PENDING.slug)).toBeNull();
  });

  it('shows the admin the correction next to its own note', async () => {
    await signInAs(ADMIN);

    const [waiting] = await listPendingListings();

    expect(waiting?.control).toMatchObject({ reviewNote: NOTE, correctedAt: expect.any(Date) });
  });

  it('clears the mark when the admin asks again', async () => {
    await signInAs(ADMIN);

    await returnListingToReview(PENDING.id, 'Falta el número de registro.');

    expect(await getDistributorControl(PENDING.id)).toMatchObject({
      reviewNote: 'Falta el número de registro.',
      correctedAt: null,
    });
  });

  it('marks an edit of the public profile as the answer too, without listing it', async () => {
    await signInAs(SEED_USERS.ownerE);

    expect(await updateDistributorProfile(PENDING.id, { addressLine: 'Av. Corregida 200' })).toBe(
      false,
    );

    expect(await stateOf(PENDING.id)).toBe('correctionsSent');
    expect((await getStaffDistributor(PENDING.id))?.acceptingOrders).toBe(false);
  });

  it('clears the note and the mark when the admin approves', async () => {
    const admin = await signInAs(ADMIN);

    expect(await approveAsSeen(PENDING.id, admin.uid)).toBe(true);

    expect(await getDistributorControl(PENDING.id)).toMatchObject({
      listingApproved: true,
      reviewNote: null,
      correctedAt: null,
    });
  });

  it('does not mark an edit of an approved listing', async () => {
    await signInAs(SEED_USERS.ownerE);

    await updateDistributorProfile(PENDING.id, { addressLine: 'Av. Aprobada 300' });

    expect(await getDistributorControl(PENDING.id)).toMatchObject({
      listingApproved: true,
      correctedAt: null,
    });
    expect(await stateOf(PENDING.id)).toBe('listed');
  });
});

// CLAUDE.md rule 10: a control document written before the copies existed.
describe('a control document older than the name and the link', () => {
  const legacy = {
    ownerUid: SEED_USERS.ownerA.uid,
    status: 'active',
    trialEndsAt: Timestamp.fromDate(new Date('2026-01-01T00:00:00Z')),
    listingApproved: false,
    createdAt: Timestamp.fromDate(new Date('2025-12-01T00:00:00Z')),
    updatedAt: Timestamp.fromDate(new Date('2025-12-01T00:00:00Z')),
  };

  beforeAll(async () => {
    await writeAsAdmin(`distributors/${A.id}/private/control`, legacy);
  });

  it('is listed without them', async () => {
    await signInAs(ADMIN);

    const waiting = await listPendingListings();

    expect(waiting.find((entry) => entry.distributorId === A.id)?.control).toMatchObject({
      distributorName: null,
      slug: null,
    });
  });

  it('gains them when the admin decides on it', async () => {
    const admin = await signInAs(ADMIN);

    expect(await approveAsSeen(A.id, admin.uid)).toBe(true);

    expect(await getDistributorControl(A.id)).toMatchObject({
      listingApproved: true,
      distributorName: A.name,
      slug: A.slug,
    });
  });
});
