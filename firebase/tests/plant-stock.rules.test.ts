// PLAN 3.4 — plant stock: full and empty cylinders per product. The staff reads it; the owner
// and the dispatcher adjust it (PLAN §11, 2026-10-16, user decision), while the distributor is
// writable; every change comes with its movement in the same request, with reason and author,
// and the two must add up. Never below zero; the history is never edited or deleted.
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
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  ADJUSTMENT_NOTE_MAX_LENGTH,
  MAX_ADJUSTMENT_UNITS,
  MAX_STOCK_UNITS,
  MOVEMENTS_QUERY_MAX,
  PLANT_STOCK_QUERY_LIMIT,
} from '../../src/domain/stock/constants';
import { STOCK_ADJUSTER_ROLES, STOCK_READER_ROLES } from '../../src/domain/stock/permissions';
import {
  ADMIN_UID,
  adjustStock,
  anonymous,
  createEnv,
  CUSTOMER_UID,
  type Db,
  MOVEMENT_ID,
  movementPath,
  OTHER_MOVEMENT_ID,
  plantStockDoc,
  plantStockPath,
  productDoc,
  productPath,
  seedDoc,
  seedWorld,
  verified,
  WORLD,
} from './helpers';

let env: RulesTestEnvironment;
const A = WORLD.a.d;
const B = WORLD.b.d;
const PAST = Timestamp.fromDate(new Date('2026-02-01T12:00:00Z'));
const SEEDED_MOVEMENT_ID = 'Movement000000000000';
const stockOf = (db: Db, d = A, productId = 'p00') => doc(db, plantStockPath(d, productId));
const stocksOf = (db: Db, d = A) => collection(db, `distributors/${d}/plantStock`);
const movementsOf = (db: Db, d = A) => collection(db, `distributors/${d}/stockMovements`);

/** The movement the seeded stock names, as an earlier adjustment left it. */
const seededMovement = (change: Record<string, unknown> = {}) => ({
  kind: 'adjustment',
  productId: 'p00',
  reason: 'count',
  note: null,
  fullDelta: 40,
  emptyDelta: 12,
  fullAfter: 40,
  emptyAfter: 12,
  authorUid: 'owner-a',
  authorName: 'A. Persona',
  createdAt: PAST,
  ...change,
});

/** A product p00 with 40 full and 12 empty, and the movement that left them. */
async function seedStock(d: string): Promise<void> {
  await seedDoc(env, productPath(d, 'p00'), productDoc({ createdAt: PAST, updatedAt: PAST }));
  await seedDoc(env, plantStockPath(d, 'p00'), plantStockDoc());
  await seedDoc(env, movementPath(d, SEEDED_MOVEMENT_ID), seededMovement());
}

beforeAll(async () => {
  env = await createEnv('plant-stock');
});

beforeEach(async () => {
  await env.clearFirestore();
  await seedWorld(env);
  await seedStock(A);
  await seedStock(B);
  await seedDoc(env, productPath(A, 'p01'), productDoc({ createdAt: PAST, updatedAt: PAST }));
});

afterAll(async () => {
  await env.cleanup();
});

describe('plant stock — read', () => {
  it.each(['owner-a', 'dispatcher-a', 'driver-a'])(
    'lets %s read the stock and its movements',
    async (uid) => {
      const db = verified(env, uid);
      await assertSucceeds(getDoc(stockOf(db)));
      await assertSucceeds(getDocs(query(stocksOf(db), limit(PLANT_STOCK_QUERY_LIMIT))));
      await assertSucceeds(getDoc(doc(db, movementPath(A, SEEDED_MOVEMENT_ID))));
      await assertSucceeds(
        getDocs(query(movementsOf(db), orderBy('createdAt', 'desc'), limit(MOVEMENTS_QUERY_MAX))),
      );
    },
  );

  it('lets the owner list the movements of one product, newest first', async () => {
    const db = verified(env, 'owner-a');
    const ofProduct = query(
      movementsOf(db),
      where('productId', '==', 'p00'),
      orderBy('createdAt', 'desc'),
      limit(20),
    );
    await assertSucceeds(getDocs(ofProduct));
  });

  it('agrees with the roles of the domain (the ones tested here)', () => {
    expect(STOCK_READER_ROLES).toEqual(['owner', 'dispatcher', 'driver']);
    expect(STOCK_ADJUSTER_ROLES).toEqual(['owner', 'dispatcher']);
  });

  it('blocks an unbounded or oversized list', async () => {
    const db = verified(env, 'owner-a');
    await assertFails(getDocs(stocksOf(db)));
    await assertFails(getDocs(query(stocksOf(db), limit(PLANT_STOCK_QUERY_LIMIT + 1))));
    await assertFails(getDocs(movementsOf(db)));
    await assertFails(getDocs(query(movementsOf(db), limit(MOVEMENTS_QUERY_MAX + 1))));
  });

  it('lets the owner of a read-only distributor still read its stock', async () => {
    await seedStock(WORLD.suspended.d);
    const db = verified(env, 'owner-suspended');
    await assertSucceeds(getDoc(stockOf(db, WORLD.suspended.d)));
    await assertSucceeds(getDocs(query(movementsOf(db, WORLD.suspended.d), limit(5))));
  });

  it.each([
    ['an anonymous visitor', () => anonymous(env)],
    ['a customer', () => verified(env, CUSTOMER_UID)],
    ['the owner of another distributor', () => verified(env, 'owner-b')],
    ['the dispatcher of another distributor', () => verified(env, 'dispatcher-b')],
    ['a driver of another distributor', () => verified(env, 'driver-b')],
    ['a platform admin', () => verified(env, ADMIN_UID)],
  ])('blocks %s from reading the stock of A or its movements', async (_who, connect) => {
    const db = connect();
    await assertFails(getDoc(stockOf(db)));
    await assertFails(getDocs(query(stocksOf(db), limit(5))));
    await assertFails(getDoc(doc(db, movementPath(A, SEEDED_MOVEMENT_ID))));
    await assertFails(getDocs(query(movementsOf(db), limit(5))));
  });
});

describe('plant stock — adjust', () => {
  const owner = () => verified(env, 'owner-a');

  it('lets the owner adjust it with its movement in the same request', async () => {
    await assertSucceeds(adjustStock(owner()));
  });

  it('lets the owner start the stock of a product never moved, from zero', async () => {
    await assertSucceeds(
      adjustStock(owner(), {
        productId: 'p01',
        before: { full: 0, empty: 0 },
        fullDelta: 25,
        emptyDelta: 0,
      }),
    );
  });

  it('lets the dispatcher adjust it and start a stock, under its own name', async () => {
    const dispatcher = verified(env, 'dispatcher-a');
    await assertSucceeds(adjustStock(dispatcher, { authorUid: 'dispatcher-a' }));
    await assertSucceeds(
      adjustStock(dispatcher, {
        authorUid: 'dispatcher-a',
        productId: 'p01',
        movementId: OTHER_MOVEMENT_ID,
        before: { full: 0, empty: 0 },
        fullDelta: 3,
        emptyDelta: 0,
      }),
    );
  });

  it('lets the owner leave a count at exactly zero', async () => {
    await assertSucceeds(adjustStock(owner(), { fullDelta: -40, emptyDelta: -12 }));
  });

  it.each([
    ['its driver (reads only)', 'driver-a'],
    ['the dispatcher of another distributor', 'dispatcher-b'],
    ['a customer', CUSTOMER_UID],
    ['the owner of another distributor', 'owner-b'],
    ['a platform admin', ADMIN_UID],
  ])('blocks %s from adjusting it', async (_who, uid) => {
    await assertFails(adjustStock(verified(env, uid), { authorUid: uid }));
  });

  it('blocks the owner of A from adjusting the stock of B (aislamiento A/B)', async () => {
    await assertFails(adjustStock(owner(), { d: B }));
  });

  it.each([
    ['suspended', WORLD.suspended, 'owner-suspended'],
    ['on an expired trial', WORLD.expired, 'owner-expired'],
    ['with a payment due', WORLD.pastDue, 'owner-past-due'],
  ] as const)('blocks the owner of a distributor that is %s', async (_case, seeded, uid) => {
    await seedStock(seeded.d);
    await assertFails(adjustStock(verified(env, uid), { d: seeded.d, authorUid: uid }));
  });

  it('blocks a change of the stock without its movement', async () => {
    await assertFails(adjustStock(owner(), { only: 'stock' }));
  });

  it('blocks a movement without the change of the stock', async () => {
    await assertFails(adjustStock(owner(), { only: 'movement' }));
  });

  it('blocks replaying an old movement whose numbers would add up again', async () => {
    // The seeded movement took the stock from zero to 40 and 12; the stock is back at zero.
    await seedDoc(env, plantStockPath(A, 'p00'), plantStockDoc({ full: 0, empty: 0 }));
    const replay = {
      only: 'stock',
      movementId: SEEDED_MOVEMENT_ID,
      before: { full: 0, empty: 0 },
      fullDelta: 40,
      emptyDelta: 12,
    } as const;
    await assertFails(adjustStock(owner(), replay));
  });

  it('blocks a stock that names a movement other than the one written', async () => {
    await assertFails(adjustStock(owner(), { stock: { lastMovementId: OTHER_MOVEMENT_ID } }));
  });

  it.each([
    [
      'moves full cylinders by more than it says',
      { stock: { full: 61 }, movement: { fullAfter: 61 } },
    ],
    [
      'moves empty cylinders by more than it says',
      { stock: { empty: 1 }, movement: { emptyAfter: 1 } },
    ],
    ['says the stock ends with other full cylinders', { movement: { fullAfter: 61 } }],
    ['says the stock ends with other empty cylinders', { movement: { emptyAfter: 1 } }],
    ['was computed from an old count', { before: { full: 30, empty: 12 } }],
  ])('blocks an adjustment that %s', async (_case, write) => {
    await assertFails(adjustStock(owner(), write));
  });

  it('blocks a first stock that does not start from zero', async () => {
    await assertFails(adjustStock(owner(), { productId: 'p01', before: { full: 40, empty: 12 } }));
  });

  it('blocks a movement about another product than the stock it changes', async () => {
    await assertFails(adjustStock(owner(), { movement: { productId: 'p01' } }));
  });

  it('blocks one movement for two products: the second would change without its line', async () => {
    // Both products hold the same counts, so the same change adds up for each of them.
    await seedDoc(env, plantStockPath(A, 'p01'), plantStockDoc());
    const db = owner();
    const batch = writeBatch(db);
    batch.set(stockOf(db, A, 'p00'), {
      full: 60,
      empty: 0,
      lastMovementId: MOVEMENT_ID,
      updatedAt: serverTimestamp(),
    });
    await assertFails(adjustStock(db, { productId: 'p01', batch }));
  });

  it.each([
    ['below zero full cylinders', { fullDelta: -41, emptyDelta: 0 }],
    ['below zero empty cylinders', { fullDelta: 0, emptyDelta: -13 }],
  ])('blocks an adjustment that leaves %s', async (_case, write) => {
    await assertFails(adjustStock(owner(), write));
  });

  it('blocks a stock above the cap', async () => {
    await seedDoc(env, plantStockPath(A, 'p00'), plantStockDoc({ full: MAX_STOCK_UNITS }));
    await assertFails(
      adjustStock(owner(), { before: { full: MAX_STOCK_UNITS, empty: 12 }, fullDelta: 1 }),
    );
  });

  it.each([
    ['full', { fullDelta: MAX_ADJUSTMENT_UNITS + 1 }],
    ['empty', { emptyDelta: MAX_ADJUSTMENT_UNITS + 1 }],
    ['full, downwards', { fullDelta: -MAX_ADJUSTMENT_UNITS - 1 }],
  ])('blocks a change of %s cylinders above the cap', async (_case, write) => {
    await seedDoc(env, plantStockPath(A, 'p00'), plantStockDoc({ full: 20000, empty: 20000 }));
    await assertFails(adjustStock(owner(), { before: { full: 20000, empty: 20000 }, ...write }));
  });

  it('accepts the largest change either way', async () => {
    await seedDoc(env, plantStockPath(A, 'p00'), plantStockDoc({ full: 20000, empty: 20000 }));
    await assertSucceeds(
      adjustStock(owner(), {
        before: { full: 20000, empty: 20000 },
        fullDelta: MAX_ADJUSTMENT_UNITS,
        emptyDelta: -MAX_ADJUSTMENT_UNITS,
      }),
    );
  });

  it('blocks an adjustment that changes nothing', async () => {
    await assertFails(adjustStock(owner(), { fullDelta: 0, emptyDelta: 0 }));
  });

  it('lets "other" through only with a note', async () => {
    await assertFails(adjustStock(owner(), { movement: { reason: 'other' } }));
    await assertSucceeds(
      adjustStock(owner(), { movement: { reason: 'other', note: 'Préstamo a otra planta' } }),
    );
  });

  it.each(['count', 'supplier', 'damaged'])('accepts the reason %s', async (reason) => {
    await assertSucceeds(adjustStock(owner(), { movement: { reason, note: 'Revisado' } }));
  });

  it.each([
    ['an unknown reason', { reason: 'gift' }],
    ['a movement of a shift (not open yet)', { kind: 'shiftOut' }],
    ['a note of punctuation only', { note: '...' }],
    ['a note with a zero-width space', { note: 'fuga​' }],
    ['an empty note (none is null)', { note: '' }],
    ['an oversized note', { note: 'n'.repeat(ADJUSTMENT_NOTE_MAX_LENGTH + 1) }],
    ['another author', { authorUid: 'dispatcher-a' }],
    ['another name than its member', { authorName: 'Otra Persona' }],
    ['a made-up date', { createdAt: PAST }],
    ['a change as text', { fullDelta: '20' }],
    ['half a cylinder', { fullDelta: 20.5 }],
    ['a product outside the slots', { productId: 'p30' }],
    ['an extra field', { approvedBy: 'owner-a' }],
  ])('blocks a movement with %s', async (_case, movement) => {
    await assertFails(adjustStock(owner(), { movement }));
  });

  it.each([
    ['an old date', { updatedAt: PAST }],
    ['an extra field', { reserved: 3 }],
    ['counts as text', { full: '60' }],
    ['a movement id that is not automatic', { lastMovementId: 'mine' }],
  ])('blocks a stock with %s', async (_case, stock) => {
    await assertFails(adjustStock(owner(), { stock }));
  });

  it('blocks a movement whose id is not automatic', async () => {
    await assertFails(adjustStock(owner(), { movementId: 'my-movement' }));
  });

  it.each([
    ['a product that does not exist', 'p05'],
    ['a slot that is not a product', 'v00'],
  ])('blocks the stock of %s', async (_case, productId) => {
    await assertFails(adjustStock(owner(), { productId, before: { full: 0, empty: 0 } }));
  });
});

describe('plant stock — history is never rewritten', () => {
  const owner = () => verified(env, 'owner-a');
  const seeded = (db: Db) => doc(db, movementPath(A, SEEDED_MOVEMENT_ID));

  it('blocks editing a movement, also for the owner', async () => {
    await assertFails(updateDoc(seeded(owner()), { fullDelta: 41 }));
  });

  it('blocks deleting a movement or a stock, also for the owner', async () => {
    await assertFails(deleteDoc(seeded(owner())));
    await assertFails(deleteDoc(stockOf(owner())));
  });

  it('blocks rewriting the stock alone, even with a fresh date', async () => {
    await assertFails(updateDoc(stockOf(owner()), { full: 41, updatedAt: serverTimestamp() }));
  });
});
