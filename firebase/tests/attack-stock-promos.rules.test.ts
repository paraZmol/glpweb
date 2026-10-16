// Attacks on the rules of vehicles, plant stock, stock movements and promotions (PLAN 3.3-3.5):
// what a driver, another distributor, a suspended one or a careless owner can try. Real holes
// are written as it.fails with the reason, so they turn red once fixed.
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
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  adjustStock,
  anonymous,
  createEnv,
  daysFromNow,
  movementPath,
  OTHER_MOVEMENT_ID,
  plantStockDoc,
  plantStockPath,
  productDoc,
  productPath,
  promotionDoc,
  promotionPath,
  seedDoc,
  seedWorld,
  vehicleDoc,
  vehiclePath,
  verified,
  WORLD,
} from './helpers';

let env: RulesTestEnvironment;
const A = WORLD.a.d;
const B = WORLD.b.d;
const S = WORLD.suspended.d;
const PAST = Timestamp.fromDate(new Date('2026-02-01T12:00:00Z'));
const SEEDED = 'Movement000000000000';

const movement = (change: Record<string, unknown> = {}) => ({
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

const stored = (change: Record<string, unknown> = {}) =>
  promotionDoc({
    startsAt: PAST,
    createdAt: PAST,
    updatedAt: PAST,
    endsAt: daysFromNow(5),
    ...change,
  });

const now = () => serverTimestamp();

beforeAll(async () => {
  env = await createEnv('attack-stock-promos');
});

beforeEach(async () => {
  await env.clearFirestore();
  await seedWorld(env);
  for (const d of [A, B, S]) {
    await seedDoc(env, productPath(d, 'p00'), productDoc({ createdAt: PAST, updatedAt: PAST }));
    await seedDoc(env, plantStockPath(d, 'p00'), plantStockDoc());
    await seedDoc(env, movementPath(d, SEEDED), movement());
    await seedDoc(env, vehiclePath(d, 'v00'), vehicleDoc({ createdAt: PAST, updatedAt: PAST }));
    await seedDoc(env, promotionPath(d, 'o00'), stored());
    await seedDoc(env, promotionPath(d, 'o01'), stored({ active: false }));
  }
});

afterAll(async () => {
  await env.cleanup();
});

describe('attack: plant stock and movements', () => {
  it('a driver cannot read the stock or the movements', async () => {
    const db = verified(env, 'driver-a');
    await assertFails(getDoc(doc(db, plantStockPath(A, 'p00'))));
    await assertFails(getDocs(query(collection(db, `distributors/${A}/plantStock`), limit(30))));
    await assertFails(getDoc(doc(db, movementPath(A, SEEDED))));
    await assertFails(
      getDocs(query(collection(db, `distributors/${A}/stockMovements`), limit(50))),
    );
  });

  it('a driver cannot adjust the stock', async () => {
    await assertFails(adjustStock(verified(env, 'driver-a'), { authorUid: 'driver-a' }));
  });

  it('a stock change without its movement fails', async () => {
    await assertFails(adjustStock(verified(env, 'owner-a'), { only: 'stock' }));
  });

  it('a stock change naming an old movement fails', async () => {
    await assertFails(
      adjustStock(verified(env, 'owner-a'), {
        only: 'stock',
        movementId: SEEDED,
        fullDelta: 0,
        emptyDelta: 0,
      }),
    );
  });

  it('a stock that does not match the movement delta fails', async () => {
    await assertFails(adjustStock(verified(env, 'owner-a'), { stock: { full: 999 } }));
  });

  it('a movement of another product fails', async () => {
    await assertFails(adjustStock(verified(env, 'owner-a'), { movement: { productId: 'p01' } }));
  });

  it('a movement without its stock change fails', async () => {
    await assertFails(adjustStock(verified(env, 'owner-a'), { only: 'movement' }));
  });

  it('a second, orphan movement in the same batch fails', async () => {
    const db = verified(env, 'owner-a');
    const batch = writeBatch(db);
    batch.set(
      doc(db, movementPath(A, OTHER_MOVEMENT_ID)),
      movement({ fullDelta: 1, emptyDelta: 0, fullAfter: 61, emptyAfter: 0, createdAt: now() }),
    );
    await assertFails(adjustStock(db, { batch }));
  });

  it('negative stock fails', async () => {
    await assertFails(adjustStock(verified(env, 'owner-a'), { fullDelta: -41 }));
    await assertFails(adjustStock(verified(env, 'owner-a'), { emptyDelta: -13 }));
  });

  it('a delta out of range fails', async () => {
    await assertFails(adjustStock(verified(env, 'owner-a'), { fullDelta: 10000 }));
  });

  it('a movement under another name or uid fails', async () => {
    await assertFails(adjustStock(verified(env, 'owner-a'), { authorName: 'Otra Persona' }));
    await assertFails(adjustStock(verified(env, 'owner-a'), { authorUid: 'dispatcher-a' }));
  });

  it('a backdated movement fails', async () => {
    await assertFails(adjustStock(verified(env, 'owner-a'), { movement: { createdAt: PAST } }));
  });

  it('movements cannot be edited or deleted, nor the stock deleted', async () => {
    const db = verified(env, 'owner-a');
    await assertFails(updateDoc(doc(db, movementPath(A, SEEDED)), { note: 'x' }));
    await assertFails(deleteDoc(doc(db, movementPath(A, SEEDED))));
    await assertFails(deleteDoc(doc(db, plantStockPath(A, 'p00'))));
  });

  it('the owner of A cannot read or adjust the stock of B', async () => {
    const db = verified(env, 'owner-a');
    await assertFails(getDoc(doc(db, plantStockPath(B, 'p00'))));
    await assertFails(getDoc(doc(db, movementPath(B, SEEDED))));
    await assertFails(adjustStock(db, { d: B }));
  });

  it('a suspended distributor cannot adjust its stock', async () => {
    await assertFails(
      adjustStock(verified(env, 'owner-suspended'), { d: S, authorUid: 'owner-suspended' }),
    );
  });

  it('stock for a product outside the catalogue fails', async () => {
    await assertFails(
      adjustStock(verified(env, 'owner-a'), {
        productId: 'p09',
        before: { full: 0, empty: 0 },
        fullDelta: 5,
        emptyDelta: 0,
      }),
    );
  });

  it('control: a correct adjustment passes', async () => {
    await assertSucceeds(adjustStock(verified(env, 'owner-a')));
  });
});

describe('attack: vehicles', () => {
  it('a driver cannot write a vehicle', async () => {
    const db = verified(env, 'driver-a');
    await assertFails(
      updateDoc(doc(db, vehiclePath(A, 'v00')), { capacityCylinders: 999, updatedAt: now() }),
    );
  });

  it('A cannot read or write the vehicles of B; a visitor cannot read them', async () => {
    const db = verified(env, 'owner-a');
    await assertFails(getDoc(doc(db, vehiclePath(B, 'v00'))));
    await assertFails(setDoc(doc(db, vehiclePath(B, 'v01')), vehicleDoc()));
    await assertFails(getDoc(doc(anonymous(env), vehiclePath(A, 'v00'))));
  });

  it('a slot out of range and a delete fail', async () => {
    const db = verified(env, 'owner-a');
    await assertFails(setDoc(doc(db, vehiclePath(A, 'v30')), vehicleDoc()));
    await assertFails(deleteDoc(doc(db, vehiclePath(A, 'v00'))));
  });

  it('a suspended distributor cannot create a vehicle', async () => {
    const db = verified(env, 'owner-suspended');
    await assertFails(setDoc(doc(db, vehiclePath(S, 'v01')), vehicleDoc()));
  });

  it.each([0, -1, 1.5, 1000])('capacity %s fails', async (capacityCylinders) => {
    const db = verified(env, 'owner-a');
    await assertFails(setDoc(doc(db, vehiclePath(A, 'v02')), vehicleDoc({ capacityCylinders })));
  });
});

describe('attack: promotions', () => {
  // HOLE (MEDIUM): hasNoBlockedPhrase only screens `conditions`; the title (visible on the card,
  // 40 chars) takes the same fake-urgency phrases. Fix: apply the same screen to the title in
  // isValidPromotion and in preparePromotion.
  it.fails('HOLE: a title with fake urgency is accepted on create', async () => {
    const db = verified(env, 'owner-a');
    await assertFails(
      setDoc(doc(db, promotionPath(A, 'o05')), promotionDoc({ title: 'Ultimas unidades' })),
    );
  });

  // Refused today, but the emulator reports the 1000-expression limit on this update, not a
  // clean false: keep an eye on it when the title screen is added.
  it('renaming a live promotion to fake urgency is refused', async () => {
    const db = verified(env, 'owner-a');
    await assertFails(
      updateDoc(doc(db, promotionPath(A, 'o00')), {
        title: 'Hasta agotar stock',
        updatedAt: now(),
      }),
    );
  });

  it('conditions with a blocked phrase fail', async () => {
    const db = verified(env, 'owner-a');
    await assertFails(
      setDoc(doc(db, promotionPath(A, 'o05')), promotionDoc({ conditions: 'Hasta agotar stock' })),
    );
  });

  it('reusing a live slot fails', async () => {
    const db = verified(env, 'owner-a');
    await assertFails(setDoc(doc(db, promotionPath(A, 'o00')), promotionDoc({ title: 'Otra' })));
  });

  it('control: reusing a slot never published passes', async () => {
    const db = verified(env, 'owner-a');
    await assertSucceeds(setDoc(doc(db, promotionPath(A, 'o01')), promotionDoc({ title: 'Otra' })));
  });

  it('shortening, reviving the price or the limits of a live one fail', async () => {
    const ref = doc(verified(env, 'owner-a'), promotionPath(A, 'o00'));
    await assertFails(updateDoc(ref, { endsAt: daysFromNow(1), updatedAt: now() }));
    await assertFails(updateDoc(ref, { priceCents: 100, updatedAt: now() }));
    await assertFails(updateDoc(ref, { maxUnitsPerOrder: 20, updatedAt: now() }));
    await assertFails(updateDoc(ref, { soldUnits: 0, title: 'X', updatedAt: now() }));
  });

  it('slot o20 fails (cap of 20)', async () => {
    await assertFails(
      setDoc(doc(verified(env, 'owner-a'), promotionPath(A, 'o20')), promotionDoc()),
    );
  });

  it('a driver, another distributor and a suspended one cannot write promotions', async () => {
    await assertFails(
      setDoc(
        doc(verified(env, 'driver-a'), promotionPath(A, 'o05')),
        promotionDoc({ createdBy: 'driver-a' }),
      ),
    );
    await assertFails(
      setDoc(doc(verified(env, 'owner-a'), promotionPath(B, 'o05')), promotionDoc()),
    );
    await assertFails(
      setDoc(
        doc(verified(env, 'owner-suspended'), promotionPath(S, 'o05')),
        promotionDoc({ createdBy: 'owner-suspended' }),
      ),
    );
  });

  it('a visitor cannot read an unpublished one, nor list without the filter or limit', async () => {
    const db = anonymous(env);
    await assertFails(getDoc(doc(db, promotionPath(A, 'o01'))));
    const col = collection(db, `distributors/${A}/promotions`);
    await assertFails(getDocs(query(col, limit(20))));
    await assertFails(getDocs(query(col, where('active', '==', true), limit(21))));
    await assertSucceeds(getDocs(query(col, where('active', '==', true), limit(20))));
  });

  it('a visitor cannot read the promotions of a suspended distributor', async () => {
    await assertFails(getDoc(doc(anonymous(env), promotionPath(S, 'o00'))));
  });

  it('a backdated createdAt or startsAt fails', async () => {
    const db = verified(env, 'owner-a');
    await assertFails(setDoc(doc(db, promotionPath(A, 'o05')), promotionDoc({ createdAt: PAST })));
    await assertFails(setDoc(doc(db, promotionPath(A, 'o05')), promotionDoc({ startsAt: PAST })));
  });

  it('raising a locked list price fails, also by shortening the lock', async () => {
    await seedDoc(
      env,
      productPath(A, 'p01'),
      productDoc({ createdAt: PAST, updatedAt: PAST, promotedUntil: daysFromNow(5) }),
    );
    const ref = doc(verified(env, 'owner-a'), productPath(A, 'p01'));
    await assertFails(updateDoc(ref, { refillPriceCents: 99000, updatedAt: now() }));
    await assertFails(
      updateDoc(ref, {
        promotedUntil: daysFromNow(1),
        refillPriceCents: 99000,
        updatedAt: now(),
      }),
    );
  });
});
