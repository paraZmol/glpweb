// Attacks on the catalogue (PLAN 3.1), /distributors/{d}/products/{slot}, and on the copy of it
// that the public profile keeps (`brands`, `priceFromCents`). Each case is written straight with
// the SDK, as a modified client would send it, skipping the forms, src/domain and the repository.
// The legitimate counterpart of each attack lives in catalog.rules.test.ts.
import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  collectionGroup,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  limit,
  limitToLast,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { PRODUCT_SLOT_IDS } from '../../src/domain/catalog/catalog';
import {
  BRAND_NAME_MAX_LENGTH,
  CATALOG_QUERY_LIMIT,
  MAX_PRICE_CENTS,
} from '../../src/domain/catalog/constants';
import {
  ADMIN_UID,
  anonymous,
  createEnv,
  CUSTOMER_UID,
  type Db,
  distributorDoc,
  memberDoc,
  productDoc,
  productPath,
  seedDoc,
  seedWorld,
  signedInAnonymously,
  unverified,
  verified,
  verifiedThrough,
  WORLD,
} from './helpers';

let env: RulesTestEnvironment;
const A = WORLD.a.d;
const B = WORLD.b.d;
const AT = Timestamp.fromDate(new Date('2026-02-01T12:00:00Z'));
const MINUTE_MS = 60_000;
const stored = (change: Record<string, unknown> = {}) =>
  productDoc({ createdAt: AT, updatedAt: AT, ...change });
const stamp = { updatedAt: serverTimestamp() };

const productOf = (db: Db, d: string, slot: string) => doc(db, productPath(d, slot));
const catalogOf = (db: Db, d: string) => collection(db, `distributors/${d}/products`);
const onSale = (db: Db, d: string) =>
  query(catalogOf(db, d), where('active', '==', true), limit(CATALOG_QUERY_LIMIT));
const profileOf = (db: Db, d: string) => doc(db, `distributors/${d}`);

/** Every seeded distributor gets one product on sale (p00) and one withdrawn (p01). */
async function seedCatalogs() {
  for (const { d } of Object.values(WORLD)) {
    await seedDoc(env, productPath(d, 'p00'), stored());
    await seedDoc(env, productPath(d, 'p01'), stored({ active: false, sortOrder: 1 }));
  }
}

beforeAll(async () => {
  env = await createEnv('attack-catalog');
});

beforeEach(async () => {
  await env.clearFirestore();
  await seedWorld(env);
  await seedCatalogs();
});

afterAll(async () => {
  await env.cleanup();
});

describe('catalogue attacks — reading what is not public', () => {
  it.each([
    ['"in" with both values', () => where('active', 'in', [true, false])],
    ['"not equal to false"', () => where('active', '!=', false)],
    ['"not in [false]"', () => where('active', 'not-in', [false])],
    ['"equal to false"', () => where('active', '==', false)],
  ])('rejects a visitor query that filters with %s', async (_case, filter) => {
    const db = anonymous(env);
    await assertFails(getDocs(query(catalogOf(db, A), filter(), limit(CATALOG_QUERY_LIMIT))));
  });

  it('rejects a visitor query ordered by "on sale" instead of filtered by it', async () => {
    const db = anonymous(env);
    await assertFails(
      getDocs(query(catalogOf(db, A), orderBy('active', 'desc'), limit(CATALOG_QUERY_LIMIT))),
    );
  });

  it('accepts "in [true]": it asks for the products on sale and nothing else', async () => {
    const db = anonymous(env);
    await assertSucceeds(
      getDocs(query(catalogOf(db, A), where('active', 'in', [true]), limit(CATALOG_QUERY_LIMIT))),
    );
  });

  it('accepts other orders over the products on sale: they reveal nothing more', async () => {
    const db = anonymous(env);
    await assertSucceeds(
      getDocs(
        query(
          catalogOf(db, A),
          where('active', '==', true),
          orderBy('refillPriceCents', 'desc'),
          limit(CATALOG_QUERY_LIMIT),
        ),
      ),
    );
  });

  it('rejects limitToLast above the cap', async () => {
    const db = anonymous(env);
    await assertFails(
      getDocs(
        query(
          catalogOf(db, A),
          where('active', '==', true),
          orderBy('sortOrder'),
          limitToLast(CATALOG_QUERY_LIMIT + 1),
        ),
      ),
    );
  });

  it('rejects a query of the staff with no limit at all', async () => {
    await assertFails(getDocs(catalogOf(verified(env, 'owner-a'), A)));
  });

  it.each([
    ['a visitor', () => anonymous(env)],
    ['the owner of A', () => verified(env, 'owner-a')],
    ['a platform admin', () => verified(env, ADMIN_UID)],
  ])('rejects a collection-group query over every catalogue, as %s', async (_case, db) => {
    const products = collectionGroup(db(), 'products');
    await assertFails(
      getDocs(query(products, where('active', '==', true), limit(CATALOG_QUERY_LIMIT))),
    );
    await assertFails(getDocs(query(products, limit(CATALOG_QUERY_LIMIT))));
  });

  it('rejects reading the catalogue of a distributor whose profile does not exist', async () => {
    await seedDoc(env, productPath('dist-ghost', 'p00'), stored());
    await assertFails(getDoc(productOf(anonymous(env), 'dist-ghost', 'p00')));
    await assertFails(getDocs(onSale(anonymous(env), 'dist-ghost')));
  });

  it('rejects a visitor reading a slot that holds nothing', async () => {
    await assertFails(getDoc(productOf(anonymous(env), A, 'p05')));
  });

  it.each([
    ['a session with a password', (uid: string) => verifiedThrough(env, uid, 'password')],
    ['an anonymous session', (uid: string) => signedInAnonymously(env, uid)],
    ['a session without a verified e-mail', (uid: string) => unverified(env, uid)],
    ['a custom token', (uid: string) => env.authenticatedContext(uid).firestore()],
  ])('rejects withdrawn products to the owner of A through %s', async (_case, session) => {
    const db = session('owner-a');
    await assertFails(getDoc(productOf(db, A, 'p01')));
    await assertFails(
      getDocs(query(catalogOf(db, A), orderBy('sortOrder'), limit(CATALOG_QUERY_LIMIT))),
    );
  });

  it('gives a session that is not of Google only what any visitor gets', async () => {
    await assertSucceeds(getDocs(onSale(signedInAnonymously(env, 'owner-a'), A)));
  });

  it('rejects withdrawn products to a member with a role it does not know', async () => {
    await seedDoc(
      env,
      `distributors/${A}/members/helper-a`,
      memberDoc(A, 'helper-a', 'helper' as never, { createdAt: AT, updatedAt: AT }),
    );
    await assertFails(getDoc(productOf(verified(env, 'helper-a'), A, 'p01')));
  });

  it('rejects withdrawn products of B to the owner of A whose membership in B is inactive', async () => {
    // A membership in B, and only an active one, opens B: the role held in A counts for nothing.
    await seedDoc(
      env,
      `distributors/${B}/members/owner-a`,
      memberDoc(B, 'owner-a', 'driver', { active: false, createdAt: AT, updatedAt: AT }),
    );
    await assertFails(getDoc(productOf(verified(env, 'owner-a'), B, 'p01')));
  });

  it('rejects withdrawn products to a platform admin, also of a listing in review', async () => {
    const db = verified(env, ADMIN_UID);
    await assertFails(getDoc(productOf(db, WORLD.pending.d, 'p00')));
    await assertFails(getDoc(productOf(db, A, 'p01')));
  });

  it('keeps a stale public flag in charge of reads, as it is of the profile', async () => {
    // Trial over but the flag still says it takes orders (nobody flipped it yet): the
    // catalogue stays as visible as the profile, and nobody can change it.
    const { expired } = WORLD;
    await seedDoc(
      env,
      `distributors/${expired.d}`,
      distributorDoc(expired.slug, { acceptingOrders: true, createdAt: AT, updatedAt: AT }),
    );
    await assertSucceeds(getDocs(onSale(anonymous(env), expired.d)));
    await assertFails(
      updateDoc(productOf(verified(env, 'owner-expired'), expired.d, 'p00'), {
        refillPriceCents: 100,
        ...stamp,
      }),
    );
  });
});

describe('catalogue attacks — who writes', () => {
  const add = (db: Db, d = A, slot = 'p02', data: Record<string, unknown> = productDoc()) =>
    setDoc(productOf(db, d, slot), data);

  it.each([
    ['a password session', () => verifiedThrough(env, 'owner-a', 'password')],
    ['an anonymous session', () => signedInAnonymously(env, 'owner-a')],
    ['an unverified e-mail', () => unverified(env, 'owner-a')],
    ['a custom token', () => env.authenticatedContext('owner-a').firestore()],
  ])('rejects the owner of A adding or editing through %s', async (_case, db) => {
    await assertFails(add(db()));
    await assertFails(updateDoc(productOf(db(), A, 'p00'), { refillPriceCents: 100, ...stamp }));
  });

  it('rejects an owner that was deactivated', async () => {
    await seedDoc(
      env,
      `distributors/${A}/members/owner-a`,
      memberDoc(A, 'owner-a', 'owner', { active: false, createdAt: AT, updatedAt: AT }),
    );
    await assertFails(add(verified(env, 'owner-a')));
    await assertFails(
      updateDoc(productOf(verified(env, 'owner-a'), A, 'p00'), { active: false, ...stamp }),
    );
  });

  it('rejects the owner of A writing in B, also when it is a driver of B', async () => {
    await seedDoc(
      env,
      `distributors/${B}/members/owner-a`,
      memberDoc(B, 'owner-a', 'driver', { createdAt: AT, updatedAt: AT }),
    );
    const db = verified(env, 'owner-a');
    await assertFails(add(db, B));
    await assertFails(updateDoc(productOf(db, B, 'p00'), { refillPriceCents: 100, ...stamp }));
  });

  it('rejects a member with a role it does not know', async () => {
    await seedDoc(
      env,
      `distributors/${A}/members/helper-a`,
      memberDoc(A, 'helper-a', 'helper' as never, { createdAt: AT, updatedAt: AT }),
    );
    await assertFails(add(verified(env, 'helper-a')));
  });

  it.each([
    ['owner-suspended', WORLD.suspended.d],
    ['owner-expired', WORLD.expired.d],
    ['owner-past-due', WORLD.pastDue.d],
  ])('rejects %s withdrawing a product or rewriting it whole', async (uid, d) => {
    const db = verified(env, uid);
    await assertFails(setDoc(productOf(db, d, 'p00'), stored({ updatedAt: serverTimestamp() })));
    await assertFails(updateDoc(productOf(db, d, 'p01'), { active: true, ...stamp }));
  });

  it.each([
    'p30',
    'p99',
    'p-1',
    'P01',
    'p0',
    'p000',
    'p00x',
    'xp00',
    'p00 ',
    'p00\n',
    'p0٠',
    'p００',
    `p${'0'.repeat(1000)}`,
  ])('rejects a product in the slot %j', async (slot) => {
    await assertFails(add(verified(env, 'owner-a'), A, slot));
  });

  it('rejects anything below a product', async () => {
    const db = verified(env, 'owner-a');
    await assertFails(setDoc(doc(db, `${productPath(A, 'p00')}/notes/n0`), { text: 'x' }));
    await assertFails(getDoc(doc(db, `${productPath(A, 'p00')}/notes/n0`)));
  });

  it('rejects deleting a product, a missing slot included, also in a batch', async () => {
    const db = verified(env, 'owner-a');
    await assertFails(deleteDoc(productOf(db, A, 'p01')));
    await assertFails(deleteDoc(productOf(db, A, 'p09')));
    const batch = writeBatch(db);
    batch.update(productOf(db, A, 'p00'), { sortOrder: 3, ...stamp });
    batch.delete(productOf(db, A, 'p01'));
    await assertFails(batch.commit());
  });

  it('rejects replacing a product by another weight under its slot, also with its dates', async () => {
    const db = verified(env, 'owner-a');
    await assertFails(setDoc(productOf(db, A, 'p00'), productDoc({ weightKg: 45 })));
    await assertFails(
      setDoc(productOf(db, A, 'p00'), stored({ weightKg: 45, updatedAt: serverTimestamp() })),
    );
  });

  it('rejects a new product over a taken slot even with merge', async () => {
    const db = verified(env, 'owner-a');
    await assertFails(setDoc(productOf(db, A, 'p00'), productDoc(), { merge: true }));
  });
});

describe('catalogue attacks — junk values', () => {
  const add = (change: Record<string, unknown>) =>
    setDoc(productOf(verified(env, 'owner-a'), A, 'p02'), productDoc(change));
  const edit = (change: Record<string, unknown>) =>
    updateDoc(productOf(verified(env, 'owner-a'), A, 'p00'), { ...change, ...stamp });

  it.each([
    ['a refill price NaN', { refillPriceCents: Number.NaN }],
    [
      'a refill price Infinity',
      { refillPriceCents: Number.POSITIVE_INFINITY, fullPriceCents: null },
    ],
    ['a refill price -Infinity', { refillPriceCents: Number.NEGATIVE_INFINITY }],
    ['a refill price of minus zero', { refillPriceCents: -0, fullPriceCents: null }],
    ['a refill price as a list', { refillPriceCents: [5200] }],
    ['a refill price as a map', { refillPriceCents: { cents: 5200 } }],
    ['a refill price as a boolean', { refillPriceCents: true }],
    ['a refill price of null', { refillPriceCents: null }],
    ['a full price NaN', { fullPriceCents: Number.NaN }],
    ['a full price Infinity', { fullPriceCents: Number.POSITIVE_INFINITY }],
    ['a full price as a string', { fullPriceCents: '18500' }],
    ['a full price of false', { fullPriceCents: false }],
    ['a weight NaN', { weightKg: Number.NaN }],
    ['a weight Infinity', { weightKg: Number.POSITIVE_INFINITY }],
    ['a negative weight', { weightKg: -10 }],
    ['a position NaN', { sortOrder: Number.NaN }],
    ['a position Infinity', { sortOrder: Number.POSITIVE_INFINITY }],
    ['a position as text', { sortOrder: '1' }],
    ['a position of null', { sortOrder: null }],
    ['"on sale" as 1', { active: 1 }],
    ['"on sale" as text', { active: 'true' }],
    ['"on sale" of null', { active: null }],
    ['a brand of one space', { brand: ' ' }],
    ['a brand of a non-breaking space', { brand: ' ' }],
    ['a brand of an ideographic space', { brand: '　' }],
    ['a brand ending in a tab', { brand: 'Marca\t' }],
    ['a brand ending in a line break', { brand: 'Marca\n' }],
    ['a brand starting with a byte-order mark', { brand: '﻿Marca' }],
    ['a brand one character too long', { brand: 'M'.repeat(BRAND_NAME_MAX_LENGTH + 1) }],
    ['a huge brand', { brand: 'M'.repeat(100_000) }],
    ['a brand as a list', { brand: ['Marca'] }],
    ['a brand of null', { brand: null }],
    ['a name of null', { name: null }],
    ['a name of spaces', { name: '   ' }],
    ['a colour with a trailing space', { brandColor: '#1757d6 ' }],
    ['a colour too short', { brandColor: '#1757d' }],
    ['a colour with alpha', { brandColor: '#1757d6ff' }],
    ['an empty colour', { brandColor: '' }],
    ['a colour that is CSS', { brandColor: 'url(x)' }],
    ['a colour of false', { brandColor: false }],
    ['a currency of null', { currency: null }],
    ['a currency in lower case', { currency: 'pen' }],
    ['a creation date as text', { createdAt: '2026-10-14T00:00:00Z' }],
    ['a creation date a minute ago', { createdAt: Timestamp.fromMillis(Date.now() - MINUTE_MS) }],
    ['an update date in a minute', { updatedAt: Timestamp.fromMillis(Date.now() + MINUTE_MS) }],
    ['an update date of null', { updatedAt: null }],
    [
      'a price above the cap with a full price above it',
      { refillPriceCents: MAX_PRICE_CENTS, fullPriceCents: MAX_PRICE_CENTS + 1 },
    ],
    [
      'a full cylinder that costs a cent less than the refill',
      { refillPriceCents: 5200, fullPriceCents: 5199 },
    ],
  ])('rejects a new product with %s', async (_case, change) => {
    await assertFails(add(change));
  });

  it.each([
    ['an update date a minute ago', { updatedAt: Timestamp.fromMillis(Date.now() - MINUTE_MS) }],
    ['an update date in a minute', { updatedAt: Timestamp.fromMillis(Date.now() + MINUTE_MS) }],
  ])('rejects an edit stamped with %s', async (_case, change) => {
    await assertFails(
      updateDoc(productOf(verified(env, 'owner-a'), A, 'p00'), { sortOrder: 2, ...change }),
    );
  });

  it.each([
    ['moves its creation date to the past', { createdAt: Timestamp.fromMillis(0) }],
    ['removes its colour field', { brandColor: deleteField() }],
    ['removes its full price field', { fullPriceCents: deleteField() }],
    ['removes its "on sale" field', { active: deleteField() }],
    ['changes its currency to the one of the distributor in lower case', { currency: 'pen' }],
    ['turns its weight into decimals of the same value', { weightKg: 10.000001 }],
    [
      'puts the refill above the cap',
      { refillPriceCents: MAX_PRICE_CENTS + 1, fullPriceCents: null },
    ],
    ['puts the refill at the full price', { refillPriceCents: 18500 }],
    // PLAN 3.5 opened `promotedUntil` (a date): not any value, nor a field of its own.
    ['writes the price lock as text', { promotedUntil: 'forever' }],
    ['adds a promotion field the rules do not know', { promotionIds: ['o00'] }],
    ['writes a price as a numeric string', { refillPriceCents: '5400' }],
    ['writes "on sale" as a string', { active: 'false' }],
  ])('rejects an edit that %s', async (_case, change) => {
    await assertFails(edit(change));
  });
});

describe('catalogue attacks — batches', () => {
  it('rejects reordering A when the batch also touches a product of B', async () => {
    const db = verified(env, 'owner-a');
    const batch = writeBatch(db);
    batch.update(productOf(db, A, 'p00'), { sortOrder: 1, ...stamp });
    batch.update(productOf(db, A, 'p01'), { sortOrder: 0, ...stamp });
    batch.update(productOf(db, B, 'p00'), { sortOrder: 5, ...stamp });
    await assertFails(batch.commit());
  });

  it('rejects a batch that fills every slot and one more', async () => {
    const db = verified(env, 'owner-a');
    const batch = writeBatch(db);
    for (const slot of [...PRODUCT_SLOT_IDS.slice(2), 'p30']) {
      batch.set(productOf(db, A, slot), productDoc());
    }
    await assertFails(batch.commit());
  });

  it('rejects a batch of a driver hidden behind a legitimate write of its own', async () => {
    const db = verified(env, 'driver-a');
    const batch = writeBatch(db);
    batch.update(productOf(db, A, 'p00'), { sortOrder: 4, ...stamp });
    await assertFails(batch.commit());
  });
});

describe('catalogue attacks — the copy in the public profile (brands, priceFromCents)', () => {
  const editProfile = (uid: string, change: Record<string, unknown>, d = A) =>
    updateDoc(profileOf(verified(env, uid), d), { ...change, ...stamp });

  // Known limit (PLAN §9): the rules cannot add up a collection, so the owner writes the copy
  // and nothing proves it true. These cases pin down its exact reach.
  it.each([
    ['a "from" price of one cent', { priceFromCents: 1 }],
    ['a "from" price no product has', { priceFromCents: 4000 }],
    ['no "from" price at all', { priceFromCents: null }],
    ['brands it does not sell', { brands: ['Otra Marca', 'Marca Tres'] }],
    ['no brands', { brands: [] }],
  ])('lets the owner write %s (known limit, not a guarantee)', async (_case, change) => {
    await assertSucceeds(editProfile('owner-a', change));
  });

  it.each([
    ['a "from" price of zero', { priceFromCents: 0 }],
    ['a negative "from" price', { priceFromCents: -1 }],
    ['a "from" price with decimals', { priceFromCents: 4000.5 }],
    ['a "from" price above the cap', { priceFromCents: MAX_PRICE_CENTS + 1 }],
    ['a "from" price as text', { priceFromCents: '4000' }],
    ['a "from" price NaN', { priceFromCents: Number.NaN }],
    ['nine brands', { brands: Array.from({ length: 9 }, (_, index) => `Marca ${index}`) }],
    ['a blank brand', { brands: [' '] }],
    ['a brand too long', { brands: ['M'.repeat(BRAND_NAME_MAX_LENGTH + 1)] }],
    ['brands that are not a list', { brands: 'Marca Uno' }],
    ['a brand that is not text', { brands: [7] }],
  ])('rejects the owner writing %s', async (_case, change) => {
    await assertFails(editProfile('owner-a', change));
  });

  it.each([
    ['opening itself to visitors', { acceptingOrders: true }],
    ['a new name its control document does not copy', { name: 'Gas Nuevo' }],
  ])('rejects the owner of a listing in review riding the copy with %s', async (_case, change) => {
    await assertFails(
      editProfile('owner-pending', { priceFromCents: 1, ...change }, WORLD.pending.d),
    );
  });

  it.each([
    ['closing itself to visitors without a reason', { acceptingOrders: false }],
    ['a new name without going back to review', { name: 'Gas Nuevo' }],
    ['a new link', { slug: 'gas-nuevo' }],
    ['another currency', { currency: 'USD' }],
    ['another creation date', { createdAt: serverTimestamp() }],
  ])('rejects the owner of A riding the copy with %s', async (_case, change) => {
    await assertFails(editProfile('owner-a', { brands: ['Marca Uno'], ...change }));
  });

  // PLAN §11, 2026-10-15: the dispatcher edits the catalogue, so it keeps the copy up to date
  // in the same transaction. That copy, and nothing else of the profile, and only a real change.
  it.each([
    ['a new "from" price', { priceFromCents: 3900 }],
    ['other brands', { brands: ['Marca Uno'] }],
  ])('lets the dispatcher of A write the copy with %s', async (_case, change) => {
    await assertSucceeds(editProfile('dispatcher-a', change));
  });

  it('rejects the dispatcher rewriting the copy as it stands', async () => {
    const profile = (await getDoc(profileOf(verified(env, 'owner-a'), A))).data();
    await assertFails(
      editProfile('dispatcher-a', {
        brands: profile?.brands,
        priceFromCents: profile?.priceFromCents,
      }),
    );
  });

  it.each([
    ['a new name', { name: 'Gas Nuevo' }],
    ['another radius', { coverageRadiusKm: 9 }],
    ['opening itself to visitors', { acceptingOrders: false }],
    ['a "from" price of zero', { priceFromCents: 0 }],
    ['a blank brand', { brands: [' '] }],
  ])('rejects the dispatcher riding the copy with %s', async (_case, change) => {
    await assertFails(editProfile('dispatcher-a', { priceFromCents: 3900, ...change }));
  });

  it('rejects the dispatcher of a distributor that cannot be written', async () => {
    await seedDoc(
      env,
      `distributors/${WORLD.suspended.d}/members/dispatcher-suspended`,
      memberDoc(WORLD.suspended.d, 'dispatcher-suspended', 'dispatcher', {
        createdAt: AT,
        updatedAt: AT,
      }),
    );
    const db = verified(env, 'dispatcher-suspended');
    await assertFails(
      updateDoc(profileOf(db, WORLD.suspended.d), { priceFromCents: 3900, ...stamp }),
    );
    await assertFails(setDoc(productOf(db, WORLD.suspended.d, 'p05'), productDoc()));
  });

  it.each(['driver-a', 'owner-b', 'dispatcher-b', CUSTOMER_UID, ADMIN_UID])(
    'rejects %s writing the copy of A',
    async (uid) => {
      await assertFails(editProfile(uid, { priceFromCents: 1 }));
      await assertFails(editProfile(uid, { brands: ['Otra Marca'] }));
    },
  );

  it('rejects a visitor writing the copy', async () => {
    await assertFails(updateDoc(profileOf(anonymous(env), A), { priceFromCents: 1, ...stamp }));
  });

  it.each([
    ['owner-suspended', WORLD.suspended.d],
    ['owner-expired', WORLD.expired.d],
    ['owner-past-due', WORLD.pastDue.d],
  ])('rejects %s writing the copy', async (uid, d) => {
    await assertFails(editProfile(uid, { priceFromCents: 1 }, d));
  });

  it('rejects the owner writing the copy through a password session', async () => {
    await assertFails(
      updateDoc(profileOf(verifiedThrough(env, 'owner-a', 'password'), A), {
        priceFromCents: 1,
        ...stamp,
      }),
    );
  });
});

describe('catalogue attacks — list prices before PLAN 3.5', () => {
  // No promotions exist yet: the owner moves a list price freely, up or down. PLAN 3.5 adds
  // "no raise while a promotion is active or scheduled" to the update rule.
  it.each([
    ['raises both prices', { refillPriceCents: 9000, fullPriceCents: 30000 }],
    ['raises the refill to the cap', { refillPriceCents: MAX_PRICE_CENTS, fullPriceCents: null }],
    ['starts selling the full cylinder', { fullPriceCents: MAX_PRICE_CENTS }],
    ['lowers the refill to one cent', { refillPriceCents: 1 }],
  ])('lets the owner of A today: %s', async (_case, change) => {
    await assertSucceeds(
      updateDoc(productOf(verified(env, 'owner-a'), A, 'p00'), { ...change, ...stamp }),
    );
  });
});
