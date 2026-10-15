// PLAN 3.1: the catalogue of each distributor, /distributors/{d}/products/{slot}.
import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PRODUCT_SLOT_IDS } from '../../src/domain/catalog/catalog';
import {
  BRAND_NAME_MAX_LENGTH,
  CATALOG_QUERY_LIMIT,
  MAX_PRICE_CENTS,
  MAX_SORT_ORDER,
  MAX_WEIGHT_KG,
  PRODUCT_NAME_MAX_LENGTH,
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
  verified,
  without,
  WORLD,
} from './helpers';

let env: RulesTestEnvironment;
const A = WORLD.a.d;
const B = WORLD.b.d;
const AT = Timestamp.fromDate(new Date('2026-02-01T12:00:00Z'));
const stored = (change: Record<string, unknown> = {}) =>
  productDoc({ createdAt: AT, updatedAt: AT, ...change });
const stamp = { updatedAt: serverTimestamp() };

const productOf = (db: Db, d: string, slot: string) => doc(db, productPath(d, slot));
const catalogOf = (db: Db, d: string) => collection(db, `distributors/${d}/products`);
const onSale = (db: Db, d: string, max = CATALOG_QUERY_LIMIT) =>
  query(catalogOf(db, d), where('active', '==', true), orderBy('sortOrder'), limit(max));
const wholeCatalog = (db: Db, d: string, max = CATALOG_QUERY_LIMIT) =>
  query(catalogOf(db, d), orderBy('sortOrder'), limit(max));

/** Every seeded distributor gets one product on sale (p00) and one withdrawn (p01). */
async function seedCatalogs() {
  for (const { d } of Object.values(WORLD)) {
    await seedDoc(env, productPath(d, 'p00'), stored());
    await seedDoc(env, productPath(d, 'p01'), stored({ active: false, sortOrder: 1 }));
  }
}

beforeAll(async () => {
  env = await createEnv('catalog');
});

beforeEach(async () => {
  await env.clearFirestore();
  await seedWorld(env);
  await seedCatalogs();
});

afterAll(async () => {
  await env.cleanup();
});

const STAFF_OF_A = ['owner-a', 'dispatcher-a', 'driver-a'];
const NOT_STAFF_OF_A = ['owner-b', 'dispatcher-b', 'driver-b', CUSTOMER_UID, ADMIN_UID];

describe('catalogue — what anybody reads', () => {
  it('lets a visitor list the products on sale of a distributor that takes orders', async () => {
    const list = await assertSucceeds(getDocs(onSale(anonymous(env), A)));
    expect(list.docs.map((product) => product.id)).toEqual(['p00']);
  });

  it.each([CUSTOMER_UID, 'owner-b', ADMIN_UID])(
    'lets %s list the products on sale of A, like any visitor',
    async (uid) => {
      await assertSucceeds(getDocs(onSale(verified(env, uid), A)));
    },
  );

  it('lets a visitor read one product on sale', async () => {
    await assertSucceeds(getDoc(productOf(anonymous(env), A, 'p00')));
  });

  it('blocks a visitor from reading a product that is not on sale', async () => {
    await assertFails(getDoc(productOf(anonymous(env), A, 'p01')));
  });

  it('blocks a visitor query that does not ask only for products on sale', async () => {
    await assertFails(getDocs(wholeCatalog(anonymous(env), A)));
  });

  it('blocks a query above the limit, or without one', async () => {
    const db = anonymous(env);
    await assertFails(getDocs(onSale(db, A, CATALOG_QUERY_LIMIT + 1)));
    await assertFails(getDocs(query(catalogOf(db, A), where('active', '==', true))));
  });

  it.each([
    ['waits for its review', WORLD.pending.d],
    ['is suspended', WORLD.suspended.d],
    ['has its trial over', WORLD.expired.d],
    ['has its payment pending', WORLD.pastDue.d],
  ])('hides from visitors the catalogue of one that %s', async (_case, d) => {
    await assertFails(getDocs(onSale(anonymous(env), d)));
    await assertFails(getDoc(productOf(anonymous(env), d, 'p00')));
  });

  it('follows the public flag, the same one that opens the profile', async () => {
    await seedDoc(
      env,
      `distributors/${A}`,
      distributorDoc(WORLD.a.slug, { acceptingOrders: false }),
    );
    await assertFails(getDocs(onSale(anonymous(env), A)));
  });
});

describe('catalogue — what the staff reads', () => {
  it.each(STAFF_OF_A)(
    'lets %s list the whole catalogue, withdrawn products included',
    async (uid) => {
      const list = await assertSucceeds(getDocs(wholeCatalog(verified(env, uid), A)));
      expect(list.size).toBe(2);
    },
  );

  it.each(STAFF_OF_A)('lets %s read a withdrawn product', async (uid) => {
    await assertSucceeds(getDoc(productOf(verified(env, uid), A, 'p01')));
  });

  it.each(NOT_STAFF_OF_A)('blocks %s from the whole catalogue of A', async (uid) => {
    await assertFails(getDocs(wholeCatalog(verified(env, uid), A)));
    await assertFails(getDoc(productOf(verified(env, uid), A, 'p01')));
  });

  it('blocks the whole catalogue to a member that was deactivated', async () => {
    await seedDoc(
      env,
      `distributors/${A}/members/driver-a`,
      memberDoc(A, 'driver-a', 'driver', { active: false, createdAt: AT, updatedAt: AT }),
    );
    await assertFails(getDocs(wholeCatalog(verified(env, 'driver-a'), A)));
  });

  it.each([
    ['owner-pending', WORLD.pending.d],
    ['driver-suspended', WORLD.suspended.d],
    ['owner-expired', WORLD.expired.d],
  ])('lets %s read its own catalogue while it is not public', async (uid, d) => {
    await assertSucceeds(getDocs(wholeCatalog(verified(env, uid), d)));
  });

  it('blocks a whole-catalogue query above the limit, also for the staff', async () => {
    await assertFails(getDocs(wholeCatalog(verified(env, 'owner-a'), A, CATALOG_QUERY_LIMIT + 1)));
  });
});

describe('catalogue — who adds a product', () => {
  const add = (db: Db, d = A, slot = 'p02', data: Record<string, unknown> = productDoc()) =>
    setDoc(productOf(db, d, slot), data);

  it('lets the owner add a product', async () => {
    await assertSucceeds(add(verified(env, 'owner-a')));
  });

  // PLAN §11, 2026-10-15: the dispatcher sets products and prices too.
  it('lets the dispatcher add a product', async () => {
    await assertSucceeds(add(verified(env, 'dispatcher-a')));
  });

  it('lets the owner of a listing that waits for review prepare its catalogue', async () => {
    await assertSucceeds(add(verified(env, 'owner-pending'), WORLD.pending.d));
  });

  it.each(['driver-a', 'owner-b', 'dispatcher-b', CUSTOMER_UID, ADMIN_UID])(
    'blocks %s from adding a product to A',
    async (uid) => {
      await assertFails(add(verified(env, uid)));
    },
  );

  it('blocks a visitor from adding a product', async () => {
    await assertFails(add(anonymous(env)));
  });

  it.each([
    ['suspended', 'owner-suspended', WORLD.suspended.d],
    ['with its trial over', 'owner-expired', WORLD.expired.d],
    ['with its payment pending', 'owner-past-due', WORLD.pastDue.d],
  ])('blocks the owner of a distributor %s', async (_case, uid, d) => {
    await assertFails(add(verified(env, uid), d));
  });

  it.each(['p30', 'p0', 'p000', 'P02', 'a0', 'product', 'p-1'])(
    'blocks a product outside the slots (%s)',
    async (slot) => {
      await assertFails(add(verified(env, 'owner-a'), A, slot));
    },
  );

  it('accepts the last slot', async () => {
    const last = PRODUCT_SLOT_IDS[PRODUCT_SLOT_IDS.length - 1] ?? '';
    await assertSucceeds(add(verified(env, 'owner-a'), A, last));
  });

  it('blocks writing a new product over a slot that is taken', async () => {
    await assertFails(add(verified(env, 'owner-a'), A, 'p00'));
  });

  it('demands the currency of the distributor', async () => {
    const { a } = WORLD;
    await seedDoc(
      env,
      `distributors/${A}`,
      distributorDoc(a.slug, {
        currency: 'USD',
        createdAt: AT,
        updatedAt: AT,
        acceptingOrders: true,
      }),
    );
    await assertFails(add(verified(env, 'owner-a'), A, 'p02', productDoc({ currency: 'PEN' })));
    await assertSucceeds(add(verified(env, 'owner-a'), A, 'p03', productDoc({ currency: 'USD' })));
  });

  it('blocks a product with a field it does not know', async () => {
    await assertFails(add(verified(env, 'owner-a'), A, 'p02', productDoc({ promoted: true })));
  });

  it.each(Object.keys(productDoc()))('blocks a product without %s', async (field) => {
    await assertFails(add(verified(env, 'owner-a'), A, 'p02', without(productDoc(), field)));
  });
});

describe('catalogue — shape of a product', () => {
  const add = (change: Record<string, unknown>) =>
    setDoc(productOf(verified(env, 'owner-a'), A, 'p02'), productDoc(change));

  it.each([
    ['a brand without a colour', { brandColor: null }],
    ['a product sold only as a refill', { fullPriceCents: null }],
    ['the smallest prices', { refillPriceCents: 1, fullPriceCents: 2 }],
    [
      'the largest prices',
      { refillPriceCents: MAX_PRICE_CENTS - 1, fullPriceCents: MAX_PRICE_CENTS },
    ],
    ['the lightest cylinder', { weightKg: 1 }],
    ['the heaviest cylinder', { weightKg: MAX_WEIGHT_KG }],
    ['a product off sale', { active: false }],
    ['the last position', { sortOrder: MAX_SORT_ORDER }],
    [
      'the longest brand and name',
      { brand: 'M'.repeat(BRAND_NAME_MAX_LENGTH), name: 'N'.repeat(PRODUCT_NAME_MAX_LENGTH) },
    ],
  ])('accepts %s', async (_case, change) => {
    await assertSucceeds(add(change));
  });

  it.each([
    ['a refill price that is not whole cents', { refillPriceCents: 5200.5 }],
    ['a refill price of zero', { refillPriceCents: 0 }],
    ['a negative refill price', { refillPriceCents: -5200 }],
    [
      'a refill price above S/ 999',
      { refillPriceCents: MAX_PRICE_CENTS + 1, fullPriceCents: null },
    ],
    ['a refill price as text', { refillPriceCents: '5200' }],
    ['a full price that is not whole cents', { fullPriceCents: 18500.5 }],
    ['a full price above S/ 999', { fullPriceCents: MAX_PRICE_CENTS + 1 }],
    ['a full price equal to the refill', { fullPriceCents: 5200 }],
    ['a full price below the refill', { fullPriceCents: 5100 }],
    ['a full price as text', { fullPriceCents: '18500' }],
    ['a full price of zero', { refillPriceCents: 1, fullPriceCents: 0 }],
    ['an enormous price', { refillPriceCents: 1e15, fullPriceCents: null }],
    ['another currency', { currency: 'USD' }],
    ['a weight of zero', { weightKg: 0 }],
    ['a weight above the cap', { weightKg: MAX_WEIGHT_KG + 1 }],
    ['a weight with decimals', { weightKg: 10.5 }],
    ['a weight as text', { weightKg: '10' }],
    ['an empty brand', { brand: '' }],
    ['a brand padded with spaces', { brand: ' Marca Uno' }],
    ['a brand too long', { brand: 'M'.repeat(BRAND_NAME_MAX_LENGTH + 1) }],
    ['a brand that is not text', { brand: 7 }],
    ['a colour in capitals', { brandColor: '#1757D6' }],
    ['a colour that is not #rrggbb', { brandColor: 'blue' }],
    ['a one-letter name', { name: 'B' }],
    ['a name too long', { name: 'N'.repeat(PRODUCT_NAME_MAX_LENGTH + 1) }],
    ['a name padded with spaces', { name: 'Balón 10 kg ' }],
    ['an "on sale" that is not a boolean', { active: 'yes' }],
    ['a negative position', { sortOrder: -1 }],
    ['a position above the cap', { sortOrder: MAX_SORT_ORDER + 1 }],
    ['a position with decimals', { sortOrder: 1.5 }],
    ['a creation date that is not now', { createdAt: AT }],
    ['an update date that is not now', { updatedAt: AT }],
  ])('blocks %s', async (_case, change) => {
    await assertFails(add(change));
  });
});

describe('catalogue — who edits a product', () => {
  const edit = (uid: string, change: Record<string, unknown>, d = A, slot = 'p00') =>
    updateDoc(productOf(verified(env, uid), d, slot), { ...change, ...stamp });

  it.each([
    ['change both prices', { refillPriceCents: 5400, fullPriceCents: 19000 }],
    ['stop selling the full cylinder', { fullPriceCents: null }],
    ['take it off sale', { active: false }],
    [
      'rename it and change its brand',
      { name: 'Balón normal', brand: 'Marca Dos', brandColor: null },
    ],
    ['move it in the list', { sortOrder: 4 }],
  ])('lets the owner %s', async (_case, change) => {
    await assertSucceeds(edit('owner-a', change));
  });

  it.each([
    ['change both prices', { refillPriceCents: 5400, fullPriceCents: 19000 }],
    ['take it off sale', { active: false }],
    ['move it in the list', { sortOrder: 4 }],
  ])('lets the dispatcher %s', async (_case, change) => {
    await assertSucceeds(edit('dispatcher-a', change));
  });

  it('lets the owner put a withdrawn product back on sale', async () => {
    await assertSucceeds(edit('owner-a', { active: true }, A, 'p01'));
  });

  it.each(['driver-a', 'owner-b', 'dispatcher-b', CUSTOMER_UID, ADMIN_UID])(
    'blocks %s from changing a price of A',
    async (uid) => {
      await assertFails(edit(uid, { refillPriceCents: 100 }));
    },
  );

  it('blocks a visitor from changing a price', async () => {
    await assertFails(
      updateDoc(productOf(anonymous(env), A, 'p00'), { refillPriceCents: 100, ...stamp }),
    );
  });

  it.each([
    ['suspended', 'owner-suspended', WORLD.suspended.d],
    ['with its trial over', 'owner-expired', WORLD.expired.d],
    ['with its payment pending', 'owner-past-due', WORLD.pastDue.d],
  ])(
    'blocks the owner of a distributor %s, also to take a product off sale',
    async (_case, uid, d) => {
      await assertFails(edit(uid, { active: false }, d));
    },
  );

  it.each([
    ['its weight', { weightKg: 45 }],
    ['its currency', { currency: 'USD' }],
    ['its creation date', { createdAt: serverTimestamp() }],
    ['a refill price above the full price', { refillPriceCents: 18600 }],
    ['a price that is not whole cents', { refillPriceCents: 5200.5 }],
    ['a field it does not know', { promotionIds: [] }],
  ])('blocks the owner from changing %s', async (_case, change) => {
    await assertFails(edit('owner-a', change));
  });

  it('blocks an edit that does not move the update date to now', async () => {
    await assertFails(
      updateDoc(productOf(verified(env, 'owner-a'), A, 'p00'), { refillPriceCents: 5400 }),
    );
  });

  it('blocks deleting a product, even for its owner', async () => {
    await assertFails(deleteDoc(productOf(verified(env, 'owner-a'), A, 'p00')));
  });

  it('blocks the owner of A from writing in the catalogue of B', async () => {
    await assertFails(edit('owner-a', { refillPriceCents: 100 }, B));
    await assertFails(setDoc(productOf(verified(env, 'owner-a'), B, 'p02'), productDoc()));
  });
});

describe('catalogue — the whole list in one batch', () => {
  it('lets the owner reorder a full catalogue of thirty products at once', async () => {
    for (const [index, slot] of PRODUCT_SLOT_IDS.entries()) {
      await seedDoc(env, productPath(A, slot), stored({ sortOrder: index }));
    }
    const db = verified(env, 'owner-a');
    const batch = writeBatch(db);
    for (const [index, slot] of PRODUCT_SLOT_IDS.entries()) {
      batch.update(productOf(db, A, slot), {
        sortOrder: PRODUCT_SLOT_IDS.length - 1 - index,
        ...stamp,
      });
    }
    await assertSucceeds(batch.commit());
  });
});
