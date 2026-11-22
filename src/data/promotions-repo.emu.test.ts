// PLAN 3.5: promotions against the emulators, through the repository the screens will use.
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { SEED_DISTRIBUTORS, SEED_USERS } from '../../tests/seed/data';
import { seedEmulators } from '../../tests/seed/seed';
import { signInAs } from '../../tests/support/emulated-session';
import { PromotionsFullError } from '../domain/pricing/errors';
import { priceOrder } from '../domain/pricing/price-order';
import { isLive, type NewPromotion, PROMOTION_SLOT_IDS } from '../domain/pricing/promotion';
import { PermissionDeniedError } from '../domain/tenancy/errors';
import { signOutSession } from './auth-repo';
import { listCatalog, updateProduct } from './products-repo';
import {
  createPromotion,
  listPromotions,
  listPublicPromotions,
  publishPromotion,
  switchOffPromotion,
  updatePromotion,
} from './promotions-repo';

const { a: A, c: SUSPENDED } = SEED_DISTRIBUTORS;
const DAY = 86_400_000;
const inDays = (days: number) => new Date(Date.now() + days * DAY);

const tenOff = (change: Partial<NewPromotion> = {}): NewPromotion => ({
  title: '10 % menos',
  deal: { type: 'percentOff', percent: 10 },
  productIds: ['p00', 'p01'],
  saleMode: 'refill',
  startsAt: 'now',
  endsAt: inDays(7),
  maxUnitsPerOrder: 2,
  totalUnits: null,
  conditions: '',
  active: true,
  ...change,
});

async function slotsOf(d: string) {
  return new Map((await listPromotions(d)).map((promotion) => [promotion.id, promotion]));
}

beforeEach(async () => {
  await signOutSession();
  await seedEmulators();
});

afterAll(async () => {
  await signOutSession();
});

describe('createPromotion', () => {
  it('saves it and locks the prices of its products until its end, in one go', async () => {
    await signInAs(SEED_USERS.ownerA);
    const endsAt = inDays(7);
    const slot = await createPromotion(A.id, SEED_USERS.ownerA.uid, tenOff({ endsAt }), new Date());

    const promotion = (await slotsOf(A.id)).get(slot);
    expect(promotion).toMatchObject({
      title: '10 % menos',
      soldUnits: 0,
      createdBy: SEED_USERS.ownerA.uid,
    });
    expect(promotion && isLive(promotion, new Date(Date.now() + 1000))).toBe(true);
    const catalog = await listCatalog(A.id);
    const locked = catalog.filter(
      (product) => product.promotedUntil?.getTime() === endsAt.getTime(),
    );
    expect(locked.map((product) => product.id)).toEqual(['p00', 'p01']);
  });

  it('prices an order with what it saved (the lock covers the promotion)', async () => {
    await signInAs(SEED_USERS.dispatcherA);
    await createPromotion(A.id, SEED_USERS.dispatcherA.uid, tenOff(), new Date());
    const [catalog, promotions] = [await listCatalog(A.id), await listPromotions(A.id)];
    const at = new Date(Date.now() + 1000);
    const order = priceOrder(
      [{ productId: 'p00', saleMode: 'refill', quantity: 1 }],
      catalog,
      promotions,
      at,
    );
    expect(order.discountCents).toBeGreaterThan(0);
  });

  it('refuses a driver and a distributor in read-only', async () => {
    await signInAs(SEED_USERS.driverA);
    await expect(
      createPromotion(A.id, SEED_USERS.driverA.uid, tenOff(), new Date()),
    ).rejects.toThrow(PermissionDeniedError);
    await signInAs(SEED_USERS.ownerC);
    await expect(
      createPromotion(
        SUSPENDED.id,
        SEED_USERS.ownerC.uid,
        tenOff({ productIds: ['p00'] }),
        new Date(),
      ),
    ).rejects.toThrow(PermissionDeniedError);
  });

  it('says when the twenty slots are alive', async () => {
    await signInAs(SEED_USERS.ownerA);
    const used = (await listPromotions(A.id)).length;
    for (let index = used; index < PROMOTION_SLOT_IDS.length; index += 1) {
      await createPromotion(
        A.id,
        SEED_USERS.ownerA.uid,
        tenOff({ productIds: ['p02'] }),
        new Date(),
      );
    }
    await expect(
      createPromotion(A.id, SEED_USERS.ownerA.uid, tenOff(), new Date()),
    ).rejects.toThrow(PromotionsFullError);
  });
});

describe('the price lock (glp-domain §6, invariant 16)', () => {
  it('refuses raising a price under a promotion, and lets it go down', async () => {
    await signInAs(SEED_USERS.ownerA);
    await createPromotion(A.id, SEED_USERS.ownerA.uid, tenOff({ productIds: ['p00'] }), new Date());
    const p00 = (await listCatalog(A.id)).find((product) => product.id === 'p00');
    const refill = p00?.refillPriceCents ?? 0;
    await expect(updateProduct(A.id, 'p00', { refillPriceCents: refill + 100 })).rejects.toThrow(
      PermissionDeniedError,
    );
    await expect(
      updateProduct(A.id, 'p00', { refillPriceCents: refill - 100 }),
    ).resolves.toBeUndefined();
  });
});

describe('editing, publishing and switching off', () => {
  it('extends one and its lock together, publishes a draft and switches one off', async () => {
    await signInAs(SEED_USERS.ownerA);
    const live = await createPromotion(A.id, SEED_USERS.ownerA.uid, tenOff(), new Date());
    const draft = await createPromotion(
      A.id,
      SEED_USERS.ownerA.uid,
      tenOff({ active: false }),
      new Date(),
    );
    const later = inDays(9);

    await updatePromotion(A.id, live, { title: 'Semana del gas', endsAt: later });
    await publishPromotion(A.id, draft);
    await switchOffPromotion(A.id, live, SEED_USERS.ownerA.uid);

    const slots = await slotsOf(A.id);
    expect(slots.get(live)).toMatchObject({
      title: 'Semana del gas',
      active: false,
      switchedOffBy: SEED_USERS.ownerA.uid,
    });
    expect(slots.get(draft)?.active).toBe(true);
    const p00 = (await listCatalog(A.id)).find((product) => product.id === 'p00');
    expect(p00?.promotedUntil?.getTime()).toBe(later.getTime());
  });

  it('answers "already off" to the second of two people switching one off at once', async () => {
    await signInAs(SEED_USERS.ownerA);
    const live = await createPromotion(A.id, SEED_USERS.ownerA.uid, tenOff(), new Date());

    const outcomes = await Promise.all([
      switchOffPromotion(A.id, live, SEED_USERS.ownerA.uid),
      switchOffPromotion(A.id, live, SEED_USERS.ownerA.uid),
    ]);
    const again = await switchOffPromotion(A.id, live, SEED_USERS.ownerA.uid);

    expect([...outcomes].sort()).toEqual(['alreadyOff', 'switchedOff']);
    expect(again).toBe('alreadyOff');
    expect((await slotsOf(A.id)).get(live)?.active).toBe(false);
  });

  it('refuses shortening it', async () => {
    await signInAs(SEED_USERS.ownerA);
    const slot = await createPromotion(A.id, SEED_USERS.ownerA.uid, tenOff(), new Date());
    await expect(updatePromotion(A.id, slot, { endsAt: inDays(3) })).rejects.toThrow(
      PermissionDeniedError,
    );
  });
});

describe('listPublicPromotions', () => {
  it('gives a visitor the published ones that have not ended, never a draft', async () => {
    await signInAs(SEED_USERS.ownerA);
    const live = await createPromotion(A.id, SEED_USERS.ownerA.uid, tenOff(), new Date());
    const draft = await createPromotion(
      A.id,
      SEED_USERS.ownerA.uid,
      tenOff({ active: false }),
      new Date(),
    );
    await signOutSession();

    const ids = (await listPublicPromotions(A.id, new Date())).map((promotion) => promotion.id);
    expect(ids).toContain(live);
    expect(ids).not.toContain(draft);
  });

  it('refuses the whole list to a visitor', async () => {
    await expect(listPromotions(A.id)).rejects.toThrow(PermissionDeniedError);
  });
});
