import { describe, expect, it } from 'vitest';
import { MAX_STOCK_UNITS } from './constants';
import { NegativeStockError, StockCapError } from './errors';
import { canAdjustPlantStock, canReadPlantStock } from './permissions';
import { adjustmentToReach, applyStockChange, emptyPlantStock } from './plant-stock';

describe('emptyPlantStock', () => {
  it('reads a product never moved as zero of each', () => {
    expect(emptyPlantStock('p03')).toEqual({
      productId: 'p03',
      full: 0,
      empty: 0,
      lastMovementId: null,
      updatedAt: null,
    });
  });
});

describe('applyStockChange', () => {
  const stock = { full: 40, empty: 12 };

  it('adds and takes away each count apart', () => {
    expect(applyStockChange(stock, { fullDelta: 20, emptyDelta: -12 })).toEqual({
      full: 60,
      empty: 0,
    });
  });

  it('may leave exactly zero', () => {
    expect(applyStockChange(stock, { fullDelta: -40, emptyDelta: 0 })).toEqual({
      full: 0,
      empty: 12,
    });
  });

  it.each([
    ['full', { fullDelta: -41, emptyDelta: 0 }],
    ['empty', { fullDelta: 0, emptyDelta: -13 }],
  ])('refuses to leave %s cylinders below zero', (_which, change) => {
    expect(() => applyStockChange(stock, change)).toThrow(NegativeStockError);
  });

  it('refuses the whole change when only one side goes below zero', () => {
    expect(() => applyStockChange(stock, { fullDelta: 5, emptyDelta: -20 })).toThrow(
      NegativeStockError,
    );
  });

  it('refuses to go above the cap', () => {
    const almost = { full: MAX_STOCK_UNITS, empty: 0 };
    expect(() => applyStockChange(almost, { fullDelta: 1, emptyDelta: 0 })).toThrow(StockCapError);
  });
});

describe('adjustmentToReach', () => {
  it('gives the change from the recorded stock to the counted one', () => {
    expect(adjustmentToReach({ full: 40, empty: 12 }, { full: 38, empty: 15 })).toEqual({
      fullDelta: -2,
      emptyDelta: 3,
    });
  });

  it('gives zero in both when the count matches', () => {
    expect(adjustmentToReach({ full: 7, empty: 1 }, { full: 7, empty: 1 })).toEqual({
      fullDelta: 0,
      emptyDelta: 0,
    });
  });
});

describe('who reads and who adjusts (PLAN §11, 2026-10-16)', () => {
  it.each([
    ['owner', true, true],
    ['dispatcher', true, false],
    ['driver', false, false],
  ] as const)('%s reads: %s, adjusts: %s', (role, reads, adjusts) => {
    expect(canReadPlantStock(role)).toBe(reads);
    expect(canAdjustPlantStock(role)).toBe(adjusts);
  });
});
