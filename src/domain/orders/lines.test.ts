// PLAN 4.2: what a customer or the office may ask for.
import { describe, expect, it } from 'vitest';
import { MAX_ORDER_LINES } from './constants';
import type { LineRequest } from './lines';
import {
  cylinderCount,
  cylindersByProduct,
  lineKey,
  lineRequestsIssue,
  listPriceOf,
} from './lines';
import { CATALOG, P10, P45 } from './test-fixtures';

const refill = (productId: string, quantity = 1): LineRequest => ({
  productId,
  saleMode: 'refill',
  quantity,
});
const full = (productId: string, quantity = 1): LineRequest => ({
  productId,
  saleMode: 'full',
  quantity,
});

describe('lineRequestsIssue', () => {
  it.each([
    ['one refill', [refill('p00')]],
    ['refill and full of the same product (two lines)', [refill('p00'), full('p00')]],
    ['exactly the cylinder limit', [refill('p00', 2), refill('p01')]],
  ])('accepts %s', (_case, lines) => {
    expect(lineRequestsIssue(lines, CATALOG, 3)).toBeNull();
  });

  it.each([
    ['nothing', [], 'empty'],
    [
      `more than ${MAX_ORDER_LINES} lines`,
      Array.from({ length: MAX_ORDER_LINES + 1 }, (_, i) => refill(`p${i}`)),
      'tooManyLines',
    ],
    ['the same product and mode twice', [refill('p00'), refill('p00')], 'duplicateLine'],
    ['zero units', [refill('p00', 0)], 'invalidQuantity'],
    ['negative units', [refill('p00', -1)], 'invalidQuantity'],
    ['half a cylinder', [refill('p00', 1.5)], 'invalidQuantity'],
    ['NaN units', [refill('p00', Number.NaN)], 'invalidQuantity'],
    [
      'an unknown sale mode',
      [{ productId: 'p00', saleMode: 'gift', quantity: 1 }],
      'invalidSaleMode',
    ],
    ['a product not in the catalogue', [refill('p29')], 'unknownProduct'],
    ['a product out of sale', [refill('p02')], 'productOff'],
    ['a full cylinder the distributor does not sell', [full('p01')], 'fullNotSold'],
    ['one cylinder over the limit', [refill('p00', 2), full('p00', 2)], 'tooManyCylinders'],
  ])('refuses %s', (_case, lines, expected) => {
    expect(lineRequestsIssue(lines as LineRequest[], CATALOG, 3)).toBe(expected);
  });
});

describe('line helpers', () => {
  it('keys a line by product and sale mode', () => {
    expect([lineKey(refill('p00')), lineKey(full('p00'))]).toEqual(['p00:refill', 'p00:full']);
  });

  it('counts every unit as a cylinder, refill or full', () => {
    expect(cylinderCount([refill('p00', 2), full('p00', 1)])).toBe(3);
  });

  it('adds the cylinders of each product across its lines', () => {
    expect(cylindersByProduct([refill('p00', 2), full('p00'), refill('p01')])).toEqual(
      new Map([
        ['p00', 3],
        ['p01', 1],
      ]),
    );
  });

  it.each([
    [P10, 'refill', 5200],
    [P10, 'full', 18_500],
    [P45, 'refill', 21_000],
    [P45, 'full', null],
  ] as const)('reads the list price of %o as %s', (product, mode, expected) => {
    expect(listPriceOf(product, mode)).toBe(expected);
  });
});
