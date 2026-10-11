// PLAN 2.11 (role-walker, 2026-10-11) — an approval is for the listing the platform admin looked
// at. It names the version of the public profile and of the private settings it reviewed, and
// the rules accept it only while both are still the stored ones: an owner who edits the listing
// while the review is open cannot get the new data approved from that screen.
import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  deleteField,
  doc,
  getDoc,
  serverTimestamp,
  Timestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  ADMIN_UID,
  backToReview,
  controlDoc,
  createEnv,
  daysFromNow,
  type Db,
  editIdentity,
  foundDistributor,
  newDistributorId,
  reviewedMarks,
  seedProfile,
  seedWorld,
  verified,
  WORLD,
} from './helpers';

let env: RulesTestEnvironment;
const PENDING = WORLD.pending.d;
const A = WORLD.a.d;
const B = WORLD.b.d;
const PAST = Timestamp.fromDate(new Date('2020-01-01T00:00:00Z'));
const stamp = { updatedAt: serverTimestamp() };

type Marks = Awaited<ReturnType<typeof reviewedMarks>>;

const admin = () => verified(env, ADMIN_UID);
const owner = () => verified(env, 'owner-pending');
const controlOf = (db: Db, d: string) => doc(db, `distributors/${d}/private/control`);
const settingsOf = (db: Db, d: string) => doc(db, `distributors/${d}/private/settings`);
const profileOf = (db: Db, d: string) => doc(db, `distributors/${d}`);
const storedControl = async (d: string) => (await getDoc(controlOf(admin(), d))).data() ?? {};

/** The approval a platform admin sends for the version it says it reviewed. */
function approve(d: string, reviewed: Record<string, unknown>, db: Db = admin()): Promise<void> {
  const batch = writeBatch(db);
  batch.update(controlOf(db, d), {
    listingApproved: true,
    approvedAt: serverTimestamp(),
    approvedBy: ADMIN_UID,
    ...reviewed,
    reviewNote: deleteField(),
    correctedAt: deleteField(),
    ...stamp,
  });
  batch.update(profileOf(db, d), { acceptingOrders: true, ...stamp });
  return batch.commit();
}

/** The admin opens the review, then the owner edits; resolves to what the admin had seen. */
async function editedAfterReview(edit: () => Promise<void>): Promise<Marks> {
  const seen = await reviewedMarks(env, PENDING);
  await edit();
  return seen;
}

const renames = () => editIdentity(owner(), PENDING, { name: 'Gas Famosa' });
const changesPhone = () => editIdentity(owner(), PENDING, { contactPhone: '900000099' });
const movesAddress = () =>
  updateDoc(profileOf(owner(), PENDING), { addressLine: 'Av. Otra 300', ...stamp });
const correctsSettings = () =>
  updateDoc(settingsOf(owner(), PENDING), { legalName: 'Gas Famosa S.A.C.', ...stamp });

beforeAll(async () => {
  env = await createEnv('approval-as-reviewed');
});

beforeEach(async () => {
  await env.clearFirestore();
  await seedWorld(env);
});

afterAll(async () => {
  await env.cleanup();
});

describe('an approval names the version that was reviewed', () => {
  it('accepts an approval for the listing as it is stored, and keeps what it was for', async () => {
    const seen = await reviewedMarks(env, PENDING);

    await assertSucceeds(approve(PENDING, seen));

    expect(await storedControl(PENDING)).toMatchObject({ listingApproved: true, ...seen });
  });

  it.each([
    ['its name', renames],
    ['its phone', changesPhone],
    ['its address, which does not even send it back to review', movesAddress],
    ['the RUC data it declared', correctsSettings],
  ])(
    'blocks the approval when the owner changed %s after the review was opened',
    async (_w, edit) => {
      const seen = await editedAfterReview(edit);

      await assertFails(approve(PENDING, seen));

      expect((await storedControl(PENDING)).listingApproved).toBe(false);
    },
  );

  it('accepts it again once the admin has the edited listing in front of it', async () => {
    await editedAfterReview(renames);

    await assertSucceeds(approve(PENDING, await reviewedMarks(env, PENDING)));
  });

  it.each([
    ['neither version', (_seen: Marks) => ({})],
    [
      'no version of the public profile',
      ({ reviewedSettingsAt }: Marks) => ({ reviewedSettingsAt }),
    ],
    ['no version of the settings', ({ reviewedProfileAt }: Marks) => ({ reviewedProfileAt })],
  ])('blocks an approval that names %s', async (_case, pick) => {
    const seen = await reviewedMarks(env, PENDING);

    await assertFails(approve(PENDING, pick(seen)));
  });

  it.each([
    ['the moment of the approval', serverTimestamp()],
    ['a date in the past', PAST],
    ['a date in the future', daysFromNow(1)],
    ['a text', '2026-02-01T12:00:00Z'],
    ['null', null],
    ['true', true],
  ])('blocks an approval whose version of the public profile is %s', async (_case, forged) => {
    const seen = await editedAfterReview(renames);

    await assertFails(approve(PENDING, { ...seen, reviewedProfileAt: forged }));
  });

  it.each([
    ['the moment of the approval', serverTimestamp()],
    ['a date in the past', PAST],
    ['a text', '2026-02-01T12:00:00Z'],
    ['null', null],
  ])('blocks an approval whose version of the settings is %s', async (_case, forged) => {
    const seen = await editedAfterReview(correctsSettings);

    await assertFails(approve(PENDING, { ...seen, reviewedSettingsAt: forged }));
  });

  it('blocks an approval that swaps the two versions', async () => {
    await renames();
    const seen = await reviewedMarks(env, PENDING);
    const swapped = {
      reviewedProfileAt: seen.reviewedSettingsAt,
      reviewedSettingsAt: seen.reviewedProfileAt,
    };

    await assertFails(approve(PENDING, swapped));
  });
});

describe('the version of a listing cannot stand still under an edit', () => {
  it.each([
    ['without a new date', {}],
    ['with the date it already had', null],
    ['with a date in the past', { updatedAt: PAST }],
    ['with a date in the future', { updatedAt: daysFromNow(1) }],
  ])('blocks an edit of the public profile %s', async (_case, date) => {
    const kept = { updatedAt: (await reviewedMarks(env, PENDING)).reviewedProfileAt };

    await assertFails(
      updateDoc(profileOf(owner(), PENDING), { addressLine: 'Av. Otra 300', ...(date ?? kept) }),
    );
  });

  it.each([
    ['without a new date', {}],
    ['with the date it already had', null],
    ['with a date in the past', { updatedAt: PAST }],
  ])('blocks an edit of the private settings %s', async (_case, date) => {
    const kept = { updatedAt: (await reviewedMarks(env, PENDING)).reviewedSettingsAt };

    await assertFails(
      updateDoc(settingsOf(owner(), PENDING), {
        legalName: 'Gas Famosa S.A.C.',
        ...(date ?? kept),
      }),
    );
  });

  it('blocks a rename that keeps the date in a batch with the return to review', async () => {
    const { reviewedProfileAt } = await reviewedMarks(env, PENDING);
    const rename = (updatedAt: unknown) => {
      const db = owner();
      const batch = writeBatch(db);
      batch.update(profileOf(db, PENDING), {
        name: 'Gas Famosa',
        acceptingOrders: false,
        updatedAt,
      });
      batch.update(controlOf(db, PENDING), { ...backToReview(), distributorName: 'Gas Famosa' });
      return batch.commit();
    };

    await assertFails(rename(reviewedProfileAt));
    await assertSucceeds(rename(serverTimestamp()));
  });

  it('blocks the staff from correcting the public flag without a new date', async () => {
    const driver = verified(env, 'driver-expired');

    await assertFails(updateDoc(profileOf(driver, WORLD.expired.d), { acceptingOrders: false }));
    await assertSucceeds(
      updateDoc(profileOf(driver, WORLD.expired.d), { acceptingOrders: false, ...stamp }),
    );
  });
});

describe('the version reviewed belongs to that distributor and to that approval', () => {
  it('is not staled by an edit of another distributor', async () => {
    const seen = await reviewedMarks(env, PENDING);
    await updateDoc(profileOf(verified(env, 'owner-b'), B), {
      addressLine: 'Av. Otra 300',
      ...stamp,
    });

    await assertSucceeds(approve(PENDING, seen));
  });

  it('blocks an approval that names the version of another distributor', async () => {
    await renames();
    await updateDoc(profileOf(verified(env, 'owner-b'), B), {
      addressLine: 'Av. Otra 300',
      ...stamp,
    });

    await assertFails(approve(PENDING, await reviewedMarks(env, B)));
  });

  it('blocks the owner from approving itself, even for the version that is stored', async () => {
    const seen = await reviewedMarks(env, PENDING);

    await assertFails(approve(PENDING, seen, owner()));
    await assertFails(approve(PENDING, seen, verified(env, 'owner-a')));
  });

  it('blocks a listing that is not approved from carrying a reviewed version', async () => {
    const seen = await reviewedMarks(env, PENDING);

    await assertFails(updateDoc(controlOf(admin(), PENDING), { ...seen, ...stamp }));
    for (const one of Object.entries(seen)) {
      const single = Object.fromEntries([one]);
      await assertFails(updateDoc(controlOf(admin(), PENDING), { ...single, ...stamp }));
      await assertFails(updateDoc(controlOf(owner(), PENDING), { ...single, ...stamp }));
    }
  });

  it('blocks a founding whose control document already names a reviewed version', async () => {
    const founder = 'founder-reviewed';
    await seedProfile(env, founder);
    const options = { d: newDistributorId('Reviewed'), uid: founder, slug: 'gas-revisada' };

    for (const field of ['reviewedProfileAt', 'reviewedSettingsAt']) {
      const control = controlDoc(founder, { slug: options.slug, [field]: serverTimestamp() });
      await assertFails(foundDistributor(verified(env, founder), { ...options, control }));
    }
    await assertSucceeds(foundDistributor(verified(env, founder), options));
  });
});

describe('an approved listing keeps the version it was approved for', () => {
  let seen: Marks;

  beforeEach(async () => {
    seen = await reviewedMarks(env, PENDING);
    await approve(PENDING, seen);
  });

  it('keeps it through a suspension and a reactivation', async () => {
    for (const [status, acceptingOrders] of [
      ['suspended', false],
      ['trial', true],
    ] as const) {
      const db = admin();
      const batch = writeBatch(db);
      batch.update(controlOf(db, PENDING), { status, ...stamp });
      batch.update(profileOf(db, PENDING), { acceptingOrders, ...stamp });
      await assertSucceeds(batch.commit());
    }

    expect(await storedControl(PENDING)).toMatchObject(seen);
  });

  it.each([
    ['rewriting the version of the public profile', { reviewedProfileAt: PAST }],
    ['rewriting the version of the settings', { reviewedSettingsAt: PAST }],
    ['removing the version of the public profile', { reviewedProfileAt: deleteField() }],
    ['removing the version of the settings', { reviewedSettingsAt: deleteField() }],
  ])('blocks the admin from %s without approving again', async (_case, change) => {
    await assertFails(updateDoc(controlOf(admin(), PENDING), { ...change, ...stamp }));
  });

  it('demands the version that is stored now to sign the approval again', async () => {
    const again = (reviewed: Record<string, unknown>) =>
      updateDoc(controlOf(admin(), PENDING), {
        approvedAt: serverTimestamp(),
        approvedBy: ADMIN_UID,
        ...reviewed,
        ...stamp,
      });

    // The approval itself moved the public profile: what was seen before it is an old version.
    await assertFails(again(seen));
    await assertFails(again({}));
    await assertSucceeds(again(await reviewedMarks(env, PENDING)));
  });

  it.each([
    ['the version of the public profile', 'reviewedProfileAt'],
    ['the version of the settings', 'reviewedSettingsAt'],
  ])('blocks a return to review that keeps %s', async (_case, field) => {
    const { [field]: _removed, ...kept } = backToReview();
    const sendBack = (db: Db) => {
      const batch = writeBatch(db);
      batch.update(controlOf(db, PENDING), kept);
      batch.update(profileOf(db, PENDING), { acceptingOrders: false, ...stamp });
      return batch.commit();
    };

    await assertFails(sendBack(admin()));
    await assertFails(sendBack(owner()));
  });

  it('lets the admin withdraw the approval and its owner send it back with a new name', async () => {
    await assertSucceeds(editIdentity(owner(), PENDING, { name: 'Gas Famosa' }));

    const control = await storedControl(PENDING);
    expect(control.listingApproved).toBe(false);
    expect(control).not.toHaveProperty('reviewedProfileAt');
    expect(control).not.toHaveProperty('reviewedSettingsAt');
  });
});

describe('a listing approved before the versions existed', () => {
  it('still accepts a status change and a return to review', async () => {
    expect(await storedControl(A)).not.toHaveProperty('reviewedProfileAt');
    const db = admin();
    const batch = writeBatch(db);
    batch.update(controlOf(db, A), { status: 'suspended', ...stamp });
    batch.update(profileOf(db, A), { acceptingOrders: false, ...stamp });

    await assertSucceeds(batch.commit());
    await assertSucceeds(updateDoc(controlOf(admin(), A), backToReview()));
  });

  it('cannot gain a reviewed version without being approved again', async () => {
    const seen = await reviewedMarks(env, A);

    await assertFails(updateDoc(controlOf(admin(), A), { ...seen, ...stamp }));
  });
});
