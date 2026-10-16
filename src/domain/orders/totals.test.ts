// PLAN 4.2, glp-domain §6.4 and §6.13: totals in integer cents, empties only for refills.
import { describe, expect, it } from 'vitest';
import type { OrderLine } from './lines';
import { line } from './test-fixtures';
import { expectedEmptiesByWeight, orderTotals } from './totals';

describe('orderTotals', () => {
  it('is all zero for no lines', () => {
    expect(orderTotals([])).toEqual({
      totalCents: 0,
      listTotalCents: 0,
      discountCents: 0,
      cylinders: 0,
      expectedEmpties: 0,
    });
  });

  it('adds refills and full cylinders, counting empties only for refills (§6.13)', () => {
    const lines = [
      line({ quantity: 2 }),
      line({ saleMode: 'full', listPriceCents: 18_500, unitPriceCents: 18_500 }),
    ];
    expect(orderTotals(lines)).toEqual({
      totalCents: 28_900,
      listTotalCents: 28_900,
      discountCents: 0,
      cylinders: 3,
      expectedEmpties: 2,
    });
  });

  it('charges a free unit nothing but still expects its empty and takes its cylinder', () => {
    const lines = [
      line({ promotionId: 'promo-1' }),
      line({ unitPriceCents: 0, discountCents: 5200, promotionId: 'promo-1' }),
    ];
    expect(orderTotals(lines)).toMatchObject({
      totalCents: 5200,
      listTotalCents: 10_400,
      discountCents: 5200,
      cylinders: 2,
      expectedEmpties: 2,
    });
  });

  it('keeps list total = total + discount', () => {
    const lines = [
      line({ quantity: 3, unitPriceCents: 4733, discountCents: 1401, promotionId: 'p' }),
    ];
    const totals = orderTotals(lines);
    expect(totals.listTotalCents).toBe(totals.totalCents + totals.discountCents);
  });

  it('handles the largest order without leaving integers', () => {
    const lines = Array.from({ length: 10 }, () =>
      line({ quantity: 99, listPriceCents: 99_900, unitPriceCents: 99_900 }),
    );
    expect(orderTotals(lines).totalCents).toBe(98_901_000);
  });

  it.each([
    ['a float unit price', { unitPriceCents: 52.5 }],
    ['a float unit price that multiplies into an integer', { unitPriceCents: 0.5, quantity: 2 }],
    ['a float list price', { listPriceCents: 5200.1 }],
    ['a float discount', { discountCents: 0.1 }],
    ['a fractional quantity', { quantity: 1.5 }],
    ['NaN', { unitPriceCents: Number.NaN }],
    ['infinity', { unitPriceCents: Number.POSITIVE_INFINITY }],
    ['an unsafe integer', { unitPriceCents: Number.MAX_SAFE_INTEGER, quantity: 2 }],
  ] as const)('throws on %s: money is never a float', (_case, change) => {
    expect(() => orderTotals([line(change as Partial<OrderLine>)])).toThrow(TypeError);
  });
});

describe('expectedEmptiesByWeight', () => {
  it('says how many empties of each weight to have ready, ignoring full cylinders', () => {
    const lines = [
      line({ quantity: 2 }),
      line({ productId: 'p01', weightKg: 45 }),
      line({ saleMode: 'full', quantity: 3 }),
      line({ productId: 'p03', quantity: 1 }),
    ];
    expect(expectedEmptiesByWeight(lines)).toEqual(
      new Map([
        [10, 3],
        [45, 1],
      ]),
    );
  });

  it('is empty for an order of full cylinders only', () => {
    expect(expectedEmptiesByWeight([line({ saleMode: 'full' })]).size).toBe(0);
  });
});
