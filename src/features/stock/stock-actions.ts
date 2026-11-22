import * as stockRepo from '../../data/plant-stock-repo';
import { type AdjustmentInput, prepareAdjustment } from '../../domain/stock/movement';
import {
  adjustmentToReach,
  type PlantStock,
  type StockLevels,
} from '../../domain/stock/plant-stock';
import { InvalidInputError, NothingChangedError } from '../../domain/tenancy/errors';

/**
 * Owner or dispatcher (PLAN 3.4; §11, 2026-10-16): moves the plant stock of one product by
 * `input` (changes either way, with its reason and, for `other`, a note) and writes its line in
 * the history. Returns the id of the movement. Throws `InvalidInputError` (per field: `reason`,
 * `note`, `fullDelta`, `emptyDelta`), `NegativeStockError`, `StockCapError`,
 * `StockProductNotFoundError`, `PermissionDeniedError` (a driver or someone outside, or the
 * distributor is read-only) or `OfflineError`.
 */
export function adjustStock(
  distributorId: string,
  authorUid: string,
  input: AdjustmentInput,
): Promise<string> {
  const prepared = prepareAdjustment(input);
  if (!prepared.ok) return Promise.reject(new InvalidInputError(prepared.issues));
  return stockRepo.adjustPlantStock({ distributorId, authorUid, adjustment: prepared.value });
}

/** A physical count, typed as the totals counted. */
export interface StockCount {
  /** The stock the person had on screen while counting. */
  current: PlantStock;
  counted: StockLevels;
  note?: string | null;
}

/**
 * Owner or dispatcher: records a physical count (reason `count`). A count is a total: it is
 * saved only while the stock is still the one on screen; if another adjustment came first,
 * nothing is written and `StockChangedError` brings the stock of the moment, to count again.
 * Throws `NothingChangedError` when the count matches, and the errors of `adjustStock`.
 */
export function recordStockCount(
  distributorId: string,
  authorUid: string,
  count: StockCount,
): Promise<string> {
  const change = adjustmentToReach(count.current, count.counted);
  if (change.fullDelta === 0 && change.emptyDelta === 0) {
    return Promise.reject(new NothingChangedError());
  }
  const prepared = prepareAdjustment({
    productId: count.current.productId,
    reason: 'count',
    note: count.note ?? null,
    ...change,
  });
  if (!prepared.ok) return Promise.reject(new InvalidInputError(prepared.issues));
  const { full, empty, lastMovementId } = count.current;
  return stockRepo.adjustPlantStock({
    distributorId,
    authorUid,
    adjustment: prepared.value,
    count: { counted: count.counted, seen: { full, empty, lastMovementId } },
  });
}
