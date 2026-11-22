// PLAN 3.5 and glp-domain §6, invariant 16: no list price goes up while a promotion covers the
// product (§11, 2026-10-16: the lock `promotedUntil` of the product).
import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  deleteField,
  doc,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { PRODUCT_SLOT_IDS } from '../../src/domain/catalog/catalog';
import { MAX_PRICE_LOCK_DAYS } from '../../src/domain/pricing/constants';
import {
  createEnv,
  daysFromNow,
  productDoc,
  productPath,
  promotionDoc,
  promotionPath,
  seedDoc,
  seedWorld,
  verified,
  WORLD,
} from './helpers';

let env: RulesTestEnvironment;
const A = WORLD.a.d;
const MS_PER_DAY = 86_400_000;
const AT = Timestamp.fromDate(new Date('2026-02-01T12:00:00Z'));
const stamp = { updatedAt: serverTimestamp() };
const LOCKED = { promotedUntil: daysFromNow(7) };
const EXPIRED = { promotedUntil: Timestamp.fromMillis(Date.now() - 60_000) };

const productOf = (uid: string, slot = 'p00') => doc(verified(env, uid), productPath(A, slot));
const seedProduct = (change: Record<string, unknown>, slot = 'p00') =>
  seedDoc(env, productPath(A, slot), productDoc({ createdAt: AT, updatedAt: AT, ...change }));
const edit = (change: Record<string, unknown>, uid = 'owner-a') =>
  updateDoc(productOf(uid), { ...change, ...stamp });

beforeAll(async () => {
  env = await createEnv('promotion-price-lock');
});

beforeEach(async () => {
  await env.clearFirestore();
  await seedWorld(env);
});

afterAll(async () => {
  await env.cleanup();
});

describe('price lock — while a promotion covers the product', () => {
  beforeEach(async () => {
    await seedProduct(LOCKED);
  });

  it.each([
    ['lower both prices', { refillPriceCents: 5000, fullPriceCents: 18000 }],
    ['rename it', { name: 'Balón normal' }],
    ['take it off sale', { active: false }],
    ['extend the lock', { promotedUntil: daysFromNow(9) }],
  ])('lets the owner %s', async (_case, change) => {
    await assertSucceeds(edit(change));
  });

  it.each([
    ['raise the refill price', { refillPriceCents: 5201 }],
    ['raise the full price', { fullPriceCents: 18501 }],
    ['stop selling the full cylinder (to put it back dearer)', { fullPriceCents: null }],
    ['move the lock earlier', { promotedUntil: daysFromNow(6) }],
    ['remove the lock', { promotedUntil: deleteField() }],
    [
      'remove the lock and raise the price at once',
      { promotedUntil: deleteField(), refillPriceCents: 5400 },
    ],
  ])('blocks the owner from trying to %s', async (_case, change) => {
    await assertFails(edit(change));
  });

  it('blocks the dispatcher from raising a price too', async () => {
    await assertFails(edit({ refillPriceCents: 5400 }, 'dispatcher-a'));
  });

  it('lets a product without a full price start selling it', async () => {
    await seedProduct({ ...LOCKED, fullPriceCents: null });
    await assertSucceeds(edit({ fullPriceCents: 19000 }));
  });
});

describe('price lock — once it is over, or without one', () => {
  it.each([
    ['without a lock', {}],
    ['with a lock that ended', EXPIRED],
  ])('lets the owner raise the prices of a product %s', async (_case, change) => {
    await seedProduct(change);
    await assertSucceeds(edit({ refillPriceCents: 5400, fullPriceCents: 19000 }));
  });

  it('lets the owner remove a lock that ended', async () => {
    await seedProduct(EXPIRED);
    await assertSucceeds(edit({ promotedUntil: deleteField() }));
  });

  it('lets the dispatcher set a lock (it only restrains the catalogue)', async () => {
    await seedProduct({});
    await assertSucceeds(edit(LOCKED, 'dispatcher-a'));
  });

  it.each([
    [
      'too far ahead',
      { promotedUntil: Timestamp.fromMillis(Date.now() + (MAX_PRICE_LOCK_DAYS + 1) * MS_PER_DAY) },
    ],
    ['that is not a date', { promotedUntil: '2026-12-01' }],
    ['that is null', { promotedUntil: null }],
  ])('blocks a lock %s', async (_case, change) => {
    await seedProduct({});
    await assertFails(edit(change));
  });

  it('lets a new product carry a lock, and no other new field', async () => {
    const add = (change: Record<string, unknown>) =>
      setDoc(productOf('owner-a', 'p05'), productDoc(change));
    await assertSucceeds(add(LOCKED));
    await assertFails(
      setDoc(productOf('owner-a', 'p06'), productDoc({ lockedUntil: daysFromNow(1) })),
    );
  });
});

// The batch of repositories/promotions-repo.ts: the promotion and the lock of each product.
describe('price lock — in the batch that adds a promotion', () => {
  it('lets the owner add one on the thirty products and lock them all at once', async () => {
    for (const slot of PRODUCT_SLOT_IDS) await seedProduct({}, slot);
    const db = verified(env, 'owner-a');
    const batch = writeBatch(db);
    batch.set(
      doc(db, promotionPath(A, 'o00')),
      promotionDoc({
        type: 'percentOff',
        priceSource: undefined,
        priceCents: undefined,
        percent: 10,
        productIds: [...PRODUCT_SLOT_IDS],
      }),
    );
    for (const slot of PRODUCT_SLOT_IDS) {
      batch.update(doc(db, productPath(A, slot)), { promotedUntil: daysFromNow(7), ...stamp });
    }
    await assertSucceeds(batch.commit());
  });
});
