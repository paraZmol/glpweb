import { MAX_STOCK_UNITS } from './constants';
import { NegativeStockError, StockCapError } from './errors';

/**
 * The cylinders of one product at the plant (PLAN 3.4), at
 * `/distributors/{d}/plantStock/{productId}`: full ones, ready to sell, and empty ones, waiting
 * to be refilled by the supplier. A product never moved has no document: it reads as zero.
 */
export interface PlantStock {
  /** Same id as the product: `p00` … `p29`. */
  productId: string;
  full: number;
  empty: number;
  /** The movement that left it like this; null for a product never moved. */
  lastMovementId: string | null;
  updatedAt: Date | null;
}

export const emptyPlantStock = (productId: string): PlantStock => ({
  productId,
  full: 0,
  empty: 0,
  lastMovementId: null,
  updatedAt: null,
});

/** How much full and empty cylinders change, either way. */
export interface StockChange {
  fullDelta: number;
  emptyDelta: number;
}

/** What the stock holds after a change. */
export interface StockLevels {
  full: number;
  empty: number;
}

/**
 * The stock after `change`. Never below zero and never above the cap: a change that would leave
 * either count out of range is refused whole (`NegativeStockError`, `StockCapError`). The same
 * arithmetic serves manual adjustments now and the movements of a shift (PLAN 5.2, 5.5) later;
 * firebase/firestore.rules checks it again.
 */
export function applyStockChange(stock: StockLevels, change: StockChange): StockLevels {
  const after = { full: stock.full + change.fullDelta, empty: stock.empty + change.emptyDelta };
  if (after.full < 0 || after.empty < 0) throw new NegativeStockError(after);
  if (after.full > MAX_STOCK_UNITS || after.empty > MAX_STOCK_UNITS) {
    throw new StockCapError(MAX_STOCK_UNITS);
  }
  return after;
}

/**
 * A physical count is typed as the totals counted; this gives the change that reaches them.
 * Zero in both means the count matched what was recorded.
 */
export function adjustmentToReach(stock: StockLevels, counted: StockLevels): StockChange {
  return { fullDelta: counted.full - stock.full, emptyDelta: counted.empty - stock.empty };
}
