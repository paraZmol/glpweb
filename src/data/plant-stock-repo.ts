import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { MOVEMENTS_QUERY_LIMIT, PLANT_STOCK_QUERY_LIMIT } from '../domain/stock/constants';
import { StockProductNotFoundError } from '../domain/stock/errors';
import type { Adjustment, StockMovement } from '../domain/stock/movement';
import { applyStockChange, type PlantStock } from '../domain/stock/plant-stock';
import { PermissionDeniedError } from '../domain/tenancy/errors';
import { memberConverter, plantStockConverter, stockMovementConverter } from './converters';
import { guarded } from './errors';
import { db } from './firebase';
import { paths } from './paths';

/**
 * The plant stock of a distributor (PLAN 3.4), one entry per product ever moved; a product
 * without one holds nothing (`emptyPlantStock`). Owner and dispatcher only. Cost: one read per
 * product moved (one when there is none), plus 1 by the rules.
 */
export function listPlantStock(d: string): Promise<PlantStock[]> {
  return guarded(async () => {
    const all = query(
      collection(db, paths.plantStock(d)).withConverter(plantStockConverter),
      limit(PLANT_STOCK_QUERY_LIMIT),
    );
    return (await getDocs(all)).docs.map((stock) => stock.data());
  });
}

/** Which movements to read: all, or those of one product; newest first. */
export interface MovementsQuery {
  productId?: string;
  /** Up to `MOVEMENTS_QUERY_MAX` (the rules refuse more); `MOVEMENTS_QUERY_LIMIT` by default. */
  pageSize?: number;
}

/**
 * The latest movements of the plant stock, newest first (PLAN 3.4). Owner and dispatcher only.
 * Cost: one read per movement (one when there is none), plus 1 by the rules. The filter by
 * product uses the index `stockMovements (productId, createdAt desc)`.
 */
export function listStockMovements(
  d: string,
  wanted: MovementsQuery = {},
): Promise<StockMovement[]> {
  return guarded(async () => {
    const movements = collection(db, paths.stockMovements(d)).withConverter(stockMovementConverter);
    const byProduct = wanted.productId ? [where('productId', '==', wanted.productId)] : [];
    const latest = query(
      movements,
      ...byProduct,
      orderBy('createdAt', 'desc'),
      limit(wanted.pageSize ?? MOVEMENTS_QUERY_LIMIT),
    );
    return (await getDocs(latest)).docs.map((movement) => movement.data());
  });
}

/** One manual adjustment of the plant stock, by whom. */
export interface StockAdjustmentRequest {
  distributorId: string;
  authorUid: string;
  /** From `prepareAdjustment`. */
  adjustment: Adjustment;
}

/**
 * Owner or dispatcher (PLAN §11, 2026-10-16), while the distributor is writable: moves the stock
 * of one product by a manual adjustment and writes its line in the history, in one transaction
 * (the rules accept neither without the other). The counts are those of the moment, read inside
 * the transaction, so two adjustments at once both count. Returns the id of the movement.
 * Throws `NegativeStockError` or `StockCapError` (nothing written), `StockProductNotFoundError`,
 * `PermissionDeniedError` (a driver or someone outside, read-only distributor) or `OfflineError`.
 * Cost: 2 reads (own member, stock; 3 the first time: the product) + 2 writes, plus 1 lookup by
 * the rules per read and 7 for the writes (8 the first time); one more read and attempt each time
 * another adjustment of the same product wins the race.
 */
export async function adjustPlantStock(request: StockAdjustmentRequest): Promise<string> {
  for (let attempt = 1; ; attempt += 1) {
    const attempted = await attemptAdjustment(request);
    if (attempted.ok) return attempted.movementId;
    // When another adjustment of the product committed first, the server judges this one
    // against the new counts and answers permission-denied, not a conflict the SDK retries.
    const moved = (await readLastMovementId(request)) !== attempted.seenMovementId;
    if (!moved || attempt >= MAX_ATTEMPTS) throw attempted.error;
  }
}

const MAX_ATTEMPTS = 3;

type Attempt =
  | { ok: true; movementId: string }
  | { ok: false; error: PermissionDeniedError; seenMovementId: string | null };

async function attemptAdjustment(request: StockAdjustmentRequest): Promise<Attempt> {
  const { distributorId: d, authorUid, adjustment } = request;
  const stockRef = doc(db, paths.plantStockOf(d, adjustment.productId));
  const movementRef = doc(collection(db, paths.stockMovements(d)));
  let seenMovementId: string | null = null;
  try {
    await guarded(() =>
      runTransaction(db, async (tx) => {
        const author = await tx.get(
          doc(db, paths.member(d, authorUid)).withConverter(memberConverter),
        );
        if (!author.exists()) throw new PermissionDeniedError();
        const stored = await tx.get(stockRef.withConverter(plantStockConverter));
        if (!stored.exists()) await requireProduct(tx, d, adjustment.productId);
        const before = stored.exists() ? stored.data() : { full: 0, empty: 0 };
        seenMovementId = stored.exists() ? stored.data().lastMovementId : null;
        const after = applyStockChange(before, adjustment);
        tx.set(stockRef, {
          ...after,
          lastMovementId: movementRef.id,
          updatedAt: serverTimestamp(),
        });
        tx.set(movementRef, {
          kind: 'adjustment',
          ...adjustment,
          fullAfter: after.full,
          emptyAfter: after.empty,
          authorUid,
          authorName: author.data().displayName,
          createdAt: serverTimestamp(),
        });
      }),
    );
    return { ok: true, movementId: movementRef.id };
  } catch (error) {
    if (!(error instanceof PermissionDeniedError)) throw error;
    return { ok: false, error, seenMovementId };
  }
}

/** What the stock of the product names now; null when it was never moved or cannot be read. */
async function readLastMovementId(request: StockAdjustmentRequest): Promise<string | null> {
  const ref = doc(db, paths.plantStockOf(request.distributorId, request.adjustment.productId));
  try {
    const now = await getDoc(ref.withConverter(plantStockConverter));
    return now.exists() ? now.data().lastMovementId : null;
  } catch {
    return null;
  }
}

type Transaction = Parameters<Parameters<typeof runTransaction>[1]>[0];

async function requireProduct(tx: Transaction, d: string, productId: string): Promise<void> {
  if (!(await tx.get(doc(db, paths.product(d, productId)))).exists()) {
    throw new StockProductNotFoundError(productId);
  }
}
