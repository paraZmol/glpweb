// PLAN 3.4: the plant stock against the emulators. The seed gives A stock of p00 (40 full, 12
// empty), p01 and p03, each with the movement of its first count; p02 was never moved.
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { SEED_DISTRIBUTORS, SEED_USERS } from '../../tests/seed/data';
import { seedEmulators } from '../../tests/seed/seed';
import { signInAs } from '../../tests/support/emulated-session';
import { NegativeStockError, StockProductNotFoundError } from '../domain/stock/errors';
import type { Adjustment } from '../domain/stock/movement';
import { PermissionDeniedError } from '../domain/tenancy/errors';
import { signOutSession } from './auth-repo';
import { adjustPlantStock, listPlantStock, listStockMovements } from './plant-stock-repo';

const { a: A, b: B } = SEED_DISTRIBUTORS;
const owner = SEED_USERS.ownerA;

const adjustment = (change: Partial<Adjustment> = {}): Adjustment => ({
  productId: 'p00',
  reason: 'supplier',
  note: null,
  fullDelta: 20,
  emptyDelta: -12,
  ...change,
});

const adjust = (change: Partial<Adjustment> = {}) =>
  adjustPlantStock({ distributorId: A.id, authorUid: owner.uid, adjustment: adjustment(change) });

async function stockOf(productId: string) {
  return (await listPlantStock(A.id)).find((stock) => stock.productId === productId);
}

beforeEach(async () => {
  await signOutSession();
  await seedEmulators();
});

afterAll(async () => {
  await signOutSession();
});

describe('plant stock', () => {
  it('lets the dispatcher read the stock and the history', async () => {
    await signInAs(SEED_USERS.dispatcherA);

    const stock = await listPlantStock(A.id);
    const history = await listStockMovements(A.id);

    expect(stock.map(({ productId, full, empty }) => [productId, full, empty])).toEqual([
      ['p00', 40, 12],
      ['p01', 25, 6],
      ['p03', 4, 1],
    ]);
    expect(history).toHaveLength(3);
  });

  it('moves the stock and writes its line, with author and what was left', async () => {
    await signInAs(owner);

    const movementId = await adjust();

    expect(await stockOf('p00')).toMatchObject({ full: 60, empty: 0, lastMovementId: movementId });
    const [latest] = await listStockMovements(A.id, { productId: 'p00' });
    expect(latest).toMatchObject({
      id: movementId,
      kind: 'adjustment',
      reason: 'supplier',
      fullDelta: 20,
      emptyDelta: -12,
      fullAfter: 60,
      emptyAfter: 0,
      authorUid: owner.uid,
      authorName: owner.displayName,
    });
  });

  it('starts the stock of a product never moved from zero', async () => {
    await signInAs(owner);

    await adjust({ productId: 'p02', reason: 'count', fullDelta: 7, emptyDelta: 2 });

    expect(await stockOf('p02')).toMatchObject({ full: 7, empty: 2 });
  });

  it('counts two adjustments made at once', async () => {
    await signInAs(owner);

    await Promise.all([
      adjust({ fullDelta: 5, emptyDelta: 0 }),
      adjust({ fullDelta: 5, emptyDelta: 0 }),
    ]);

    expect(await stockOf('p00')).toMatchObject({ full: 50, empty: 12 });
    expect(await listStockMovements(A.id, { productId: 'p00' })).toHaveLength(3);
  });

  it('refuses to leave the stock below zero, and writes nothing', async () => {
    await signInAs(owner);

    await expect(adjust({ fullDelta: -41, emptyDelta: 0 })).rejects.toBeInstanceOf(
      NegativeStockError,
    );
    expect(await stockOf('p00')).toMatchObject({ full: 40, empty: 12 });
    expect(await listStockMovements(A.id)).toHaveLength(3);
  });

  it('says when the product is not in the catalogue', async () => {
    await signInAs(owner);

    await expect(adjust({ productId: 'p09' })).rejects.toBeInstanceOf(StockProductNotFoundError);
  });

  it('refuses the dispatcher as an adjuster, the driver as a reader and another distributor', async () => {
    await signInAs(SEED_USERS.dispatcherA);
    await expect(
      adjustPlantStock({
        distributorId: A.id,
        authorUid: SEED_USERS.dispatcherA.uid,
        adjustment: adjustment(),
      }),
    ).rejects.toBeInstanceOf(PermissionDeniedError);

    await signInAs(SEED_USERS.driverA);
    await expect(listPlantStock(A.id)).rejects.toBeInstanceOf(PermissionDeniedError);
    await expect(listStockMovements(A.id)).rejects.toBeInstanceOf(PermissionDeniedError);

    await signInAs(SEED_USERS.ownerB);
    await expect(listPlantStock(A.id)).rejects.toBeInstanceOf(PermissionDeniedError);
    expect((await listPlantStock(B.id)).map((stock) => stock.full)).toEqual([30]);
  });
});
