// Attacks on the founding batch (PLAN 2.2): pieces that ride along with a valid founding, two
// foundings in one request, the edges of the trial window, forged tokens and hostile ids.
import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  doc,
  getDoc,
  serverTimestamp,
  Timestamp,
  type WriteBatch,
  writeBatch,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  controlDoc,
  createEnv,
  CUSTOMER_UID,
  type Db,
  distributorDoc,
  emailOf,
  foundDistributor,
  type FoundingOptions,
  memberDoc,
  privateDoc,
  seedDoc,
  seedProfile,
  seedWorld,
  slugDoc,
  userDoc,
  verified,
  WORLD,
} from './helpers';

let env: RulesTestEnvironment;
const FOUNDER = 'founder';
const NEW = { d: 'dist-new', uid: FOUNDER, slug: 'gas-nuevo' } satisfies FoundingOptions;
const PAST = Timestamp.fromDate(new Date('2020-01-01T00:00:00Z'));
const stamp = { updatedAt: serverTimestamp() };
const old = { createdAt: PAST, updatedAt: PAST };
const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

beforeAll(async () => {
  env = await createEnv('attack-founding');
});

beforeEach(async () => {
  await env.clearFirestore();
  await seedWorld(env);
  await seedProfile(env, FOUNDER);
});

afterAll(async () => {
  await env.cleanup();
});

/** The five documents of a founding, without the founder's profile. */
function addFounding(batch: WriteBatch, db: Db, d: string, slug: string, uid = FOUNDER) {
  batch.set(doc(db, `distributors/${d}`), distributorDoc(slug));
  batch.set(doc(db, `distributors/${d}/private/control`), controlDoc(uid));
  batch.set(doc(db, `slugs/${slug}`), slugDoc(d));
  batch.set(doc(db, `distributors/${d}/members/${uid}`), memberDoc(d, uid, 'owner'));
  batch.set(doc(db, `distributors/${d}/private/settings`), privateDoc(uid));
}

/** A complete, valid founding of NEW plus whatever `extra` adds to the same batch. */
function foundingWith(db: Db, extra: (batch: WriteBatch) => void): Promise<void> {
  const batch = writeBatch(db);
  addFounding(batch, db, NEW.d, NEW.slug);
  batch.update(doc(db, `users/${FOUNDER}`), { ownedDistributorIds: [NEW.d], ...stamp });
  extra(batch);
  return batch.commit();
}

describe('founding — two distributors in one request', () => {
  it.each([
    ['recording both', ['dist-new', 'dist-two']],
    ['recording only the first', ['dist-new']],
    ['recording only the second', ['dist-two']],
  ])('blocks a batch that founds two, %s', async (_case, ownedDistributorIds) => {
    const db = verified(env, FOUNDER);
    const batch = writeBatch(db);
    addFounding(batch, db, 'dist-new', 'gas-nuevo');
    addFounding(batch, db, 'dist-two', 'gas-dos');
    batch.update(doc(db, `users/${FOUNDER}`), { ownedDistributorIds, ...stamp });

    await assertFails(batch.commit());
  });
});

describe('founding — a valid batch that carries something extra', () => {
  it('founds when nothing rides along (the twin of every attack below)', async () => {
    await assertSucceeds(foundingWith(verified(env, FOUNDER), () => {}));
  });

  it.each<[string, (batch: WriteBatch, db: Db) => void]>([
    [
      'a second slug for the same distributor',
      (batch, db) => batch.set(doc(db, 'slugs/gas-acaparado'), slugDoc(NEW.d)),
    ],
    [
      'a slug that points at a distributor of someone else',
      (batch, db) => batch.set(doc(db, 'slugs/gas-ajeno'), slugDoc(WORLD.a.d)),
    ],
    [
      'a friend as second owner',
      (batch, db) =>
        batch.set(
          doc(db, `distributors/${NEW.d}/members/${CUSTOMER_UID}`),
          memberDoc(NEW.d, CUSTOMER_UID, 'owner'),
        ),
    ],
    [
      'a friend as driver',
      (batch, db) =>
        batch.set(
          doc(db, `distributors/${NEW.d}/members/${CUSTOMER_UID}`),
          memberDoc(NEW.d, CUSTOMER_UID, 'driver'),
        ),
    ],
    [
      'its own membership as owner of A',
      (batch, db) =>
        batch.set(
          doc(db, `distributors/${WORLD.a.d}/members/${FOUNDER}`),
          memberDoc(WORLD.a.d, FOUNDER, 'owner'),
        ),
    ],
    [
      'a new control document for A',
      (batch, db) =>
        batch.set(doc(db, `distributors/${WORLD.a.d}/private/control`), controlDoc(FOUNDER)),
    ],
    [
      'new private settings for A',
      (batch, db) =>
        batch.set(doc(db, `distributors/${WORLD.a.d}/private/settings`), privateDoc(FOUNDER)),
    ],
    [
      'a rename of A',
      (batch, db) => batch.update(doc(db, `distributors/${WORLD.a.d}`), { name: 'Mío', ...stamp }),
    ],
    [
      'a platform admin document for the founder',
      (batch, db) =>
        batch.set(doc(db, `platformAdmins/${FOUNDER}`), { createdAt: serverTimestamp() }),
    ],
    [
      'an order in the new distributor',
      (batch, db) => batch.set(doc(db, `distributors/${NEW.d}/orders/o1`), { status: 'pending' }),
    ],
    [
      'a third private document',
      (batch, db) => batch.set(doc(db, `distributors/${NEW.d}/private/billing`), { plan: 'pro' }),
    ],
  ])('blocks a founding that carries %s', async (_case, extra) => {
    const db = verified(env, FOUNDER);
    await assertFails(foundingWith(db, (batch) => extra(batch, db)));

    const created = await getDoc(doc(db, `distributors/${NEW.d}`));
    expect(created.exists()).toBe(false);
  });
});

describe('founding — reusing a founding that already happened', () => {
  beforeEach(async () => {
    await foundDistributor(verified(env, FOUNDER), NEW);
  });

  it('blocks another account from joining the distributor right after it is founded', async () => {
    await seedProfile(env, 'latecomer');
    const db = verified(env, 'latecomer');
    const d = NEW.d;

    await assertFails(
      writeBatch(db)
        .set(doc(db, `distributors/${d}/members/latecomer`), memberDoc(d, 'latecomer', 'owner'))
        .update(doc(db, 'users/latecomer'), { ownedDistributorIds: [d], ...stamp })
        .commit(),
    );
    await assertFails(
      writeBatch(db)
        .update(doc(db, 'users/latecomer'), { ownedDistributorIds: [d], ...stamp })
        .commit(),
    );
  });

  it('blocks the founder from founding it again to restart the trial or take a second slug', async () => {
    const db = verified(env, FOUNDER);
    await assertFails(foundDistributor(db, { ...NEW, userUpdate: false }));
    await assertFails(foundDistributor(db, { ...NEW, slug: 'gas-segundo', userUpdate: false }));
    await assertFails(writeBatch(db).set(doc(db, 'slugs/gas-segundo'), slugDoc(NEW.d)).commit());
  });

  it('blocks the founder from adding staff directly afterwards', async () => {
    const db = verified(env, FOUNDER);
    const friend = doc(db, `distributors/${NEW.d}/members/${CUSTOMER_UID}`);
    await assertFails(
      writeBatch(db)
        .set(friend, memberDoc(NEW.d, CUSTOMER_UID, 'driver'))
        .commit(),
    );
  });
});

describe('founding — the trial window at its edges', () => {
  const trialOf = (ms: number) =>
    controlDoc(FOUNDER, { trialEndsAt: Timestamp.fromMillis(Date.now() + ms) });

  it.each([
    ['29 days and five minutes', 29 * DAY + 5 * MINUTE],
    ['exactly 30 days by the device clock', 30 * DAY],
    ['30 days and 55 minutes', 30 * DAY + 55 * MINUTE],
  ])('accepts a trial of %s', async (_case, ms) => {
    await assertSucceeds(
      foundDistributor(verified(env, FOUNDER), { ...NEW, control: trialOf(ms) }),
    );
  });

  it.each([
    ['29 days less five minutes', 29 * DAY - 5 * MINUTE],
    ['30 days and 65 minutes', 30 * DAY + 65 * MINUTE],
    ['31 days', 31 * DAY],
    ['no time at all', 0],
  ])('blocks a trial of %s', async (_case, ms) => {
    await assertFails(foundDistributor(verified(env, FOUNDER), { ...NEW, control: trialOf(ms) }));
  });
});

describe('founding — forged identity', () => {
  it.each([
    ['e-mail verified as the text "true"', { email: emailOf(FOUNDER), email_verified: 'true' }],
    ['e-mail verified as 1', { email: emailOf(FOUNDER), email_verified: 1 }],
    ['no e-mail claims at all', {}],
    ['a verified claim but no e-mail', { email_verified: true }],
    [
      'a verified e-mail that is not the one it writes',
      { email: 'otra@example.com', email_verified: true },
    ],
  ])('blocks a token with %s', async (_case, token) => {
    const db = env.authenticatedContext(FOUNDER, token as never).firestore();
    await assertFails(foundDistributor(db, NEW));
  });

  it('blocks founding in the name of another account', async () => {
    // The attacker writes every piece with the victim as founder, and then with itself as
    // founder but the victim's profile carrying the distributor.
    await seedProfile(env, 'attacker');
    const db = verified(env, 'attacker');
    await assertFails(foundDistributor(db, { ...NEW, uid: CUSTOMER_UID }));

    const batch = writeBatch(db);
    addFounding(batch, db, NEW.d, NEW.slug, 'attacker');
    batch.update(doc(db, `users/${CUSTOMER_UID}`), { ownedDistributorIds: [NEW.d], ...stamp });
    await assertFails(batch.commit());
  });
});

describe('founding — hostile ids and slugs', () => {
  it.each([
    ['a dot', 'dist.new'],
    ['a space at the end', 'dist-new '],
    ['a line break', 'dist-new\n'],
    ['an accent', 'distribuidóra'],
    ['a Cyrillic look-alike', 'dist-nеw'],
    ['a zero-width space', 'dist​new'],
  ])('blocks a distributor id with %s', async (_case, d) => {
    await assertFails(foundDistributor(verified(env, FOUNDER), { ...NEW, d }));
  });

  it.each([
    ['a line break at the end', 'gas-nuevo\n'],
    ['a space at the end', 'gas-nuevo '],
    ['a Cyrillic "a" that looks like the slug of A', 'gаs-demo-a'],
    ['full-width letters', 'ｇａｓ-nuevo'],
    ['a zero-width space', 'gas​-nuevo'],
    ['a right-to-left override', '‮gas-nuevo'],
    ['an upper-case copy of the slug of A', 'GAS-DEMO-A'],
    ['a dotless i', 'gas-rapıdo'],
    ['a slash-free path trick', 'gas-nuevo%2Fotro'],
  ])('blocks a slug with %s', async (_case, slug) => {
    await assertFails(foundDistributor(verified(env, FOUNDER), { ...NEW, slug }));
  });
});

describe('founding — the list of founded distributors in the profile', () => {
  const OWNED = 'dist-owned';

  beforeEach(async () => {
    await seedDoc(env, `users/${FOUNDER}`, userDoc({ ownedDistributorIds: [OWNED], ...old }));
  });

  const found = (ownedDistributorIds: unknown) =>
    foundDistributor(verified(env, FOUNDER), {
      ...NEW,
      userUpdate: { ownedDistributorIds, ...stamp },
    });

  it('accepts the new id appended after the ones it had', async () => {
    await assertSucceeds(found([OWNED, NEW.d]));
  });

  it.each([
    ['put first, pushing the old one back', [NEW.d, OWNED]],
    ['replacing the old one', [NEW.d]],
    ['written twice', [NEW.d, NEW.d]],
    ['written twice after the old one', [OWNED, NEW.d, NEW.d]],
    ['with the old one dropped and a filler', ['dist-ghost', NEW.d]],
    ['not written at all', [OWNED]],
    ['as text', NEW.d],
    ['inside a nested list-like map', { 0: OWNED, 1: NEW.d }],
  ])('blocks the new id %s', async (_case, ownedDistributorIds) => {
    await assertFails(found(ownedDistributorIds));
  });

  it('blocks a full list from growing, whatever it holds', async () => {
    const full = ['dist-1', 'dist-2', 'dist-3'];
    await seedDoc(env, `users/${FOUNDER}`, userDoc({ ownedDistributorIds: full, ...old }));

    await assertFails(found([...full, NEW.d]));
    await assertFails(found(['dist-1', 'dist-2', NEW.d]));
    await assertFails(found(full));
  });
});
