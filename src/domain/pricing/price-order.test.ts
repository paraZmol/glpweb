// PLAN 3.5 and 4.2 ("promoción aplicada, precios congelados"): priceOrder.
import { describe, expect, it } from 'vitest';
import { at, CATALOG, DAY, NOW, product, promotion } from '../../../tests/support/pricing-fixtures';
import { InvalidQuantityError, UnpricedItemError } from './errors';
import { type OrderItem, priceOrder } from './price-order';
import type { Promotion } from './promotion';

const refill = (productId: string, quantity: number): OrderItem => ({
  productId,
  saleMode: 'refill',
  quantity,
});
const full = (productId: string, quantity: number): OrderItem => ({
  productId,
  saleMode: 'full',
  quantity,
});
const price = (items: OrderItem[], promotions: Promotion[] = [], products = CATALOG) =>
  priceOrder(items, products, promotions, NOW);

describe('priceOrder without promotions', () => {
  it('charges the list price of each line', () => {
    const order = price([refill('p00', 2), full('p02', 1)]);
    expect(order.lines).toEqual([
      {
        productId: 'p00',
        saleMode: 'refill',
        quantity: 2,
        listPriceCents: 5200,
        discountCents: 0,
        totalCents: 10400,
        promotionId: null,
      },
      {
        productId: 'p02',
        saleMode: 'full',
        quantity: 1,
        listPriceCents: 9000,
        discountCents: 0,
        totalCents: 9000,
        promotionId: null,
      },
    ]);
    expect(order).toMatchObject({ listTotalCents: 19400, discountCents: 0, totalCents: 19400 });
  });

  it('merges two entries of the same product sold the same way', () => {
    const order = price([refill('p00', 1), refill('p00', 2)]);
    expect(order.lines).toHaveLength(1);
    expect(order.lines[0]?.quantity).toBe(3);
  });

  it('keeps a refill and a full cylinder of the same product apart', () => {
    expect(price([refill('p00', 1), full('p00', 1)]).lines).toHaveLength(2);
  });

  it('answers an empty order with nothing to pay', () => {
    expect(price([])).toEqual({ lines: [], listTotalCents: 0, discountCents: 0, totalCents: 0 });
  });

  it.each([
    ['a product it does not know', refill('p29', 1)],
    ['a product off sale', refill('p03', 1)],
    ['a full cylinder it does not sell', full('p01', 1)],
  ])('refuses %s', (_case, item) => {
    const products = [...CATALOG, product({ id: 'p03', active: false })];
    expect(() => price([item], [], products)).toThrow(UnpricedItemError);
  });

  it.each([0, -1, 1.5, Number.NaN])('refuses a quantity of %s', (quantity) => {
    expect(() => price([refill('p00', quantity)])).toThrow(InvalidQuantityError);
  });
});

describe('priceOrder with one promotion', () => {
  it('applies a special price (P1) and keeps the honest "before"', () => {
    const order = price([refill('p00', 1)], [promotion()]);
    expect(order.lines).toEqual([
      {
        productId: 'p00',
        saleMode: 'refill',
        quantity: 1,
        listPriceCents: 5200,
        discountCents: 400,
        totalCents: 4800,
        promotionId: 'o00',
      },
    ]);
    expect(order).toMatchObject({ listTotalCents: 5200, discountCents: 400, totalCents: 4800 });
  });

  it('puts the units beyond the cap per order in a line of their own at list price', () => {
    const order = price([refill('p00', 3)], [promotion({ maxUnitsPerOrder: 2 })]);
    expect(order.lines.map((line) => [line.quantity, line.totalCents, line.promotionId])).toEqual([
      [2, 9600, 'o00'],
      [1, 5200, null],
    ]);
    expect(order.totalCents).toBe(14800);
  });

  it('gives only the units left under the total cap', () => {
    const order = price([refill('p00', 2)], [promotion({ totalUnits: 40, soldUnits: 39 })]);
    expect(order.lines.map((line) => [line.quantity, line.promotionId])).toEqual([
      [1, 'o00'],
      [1, null],
    ]);
  });

  it('applies "balón completo al precio del gas" (P3) at the refill price of today', () => {
    const p3 = promotion({
      deal: { type: 'fixedPrice', priceSource: 'refill' },
      saleMode: 'full',
      maxUnitsPerOrder: 1,
      totalUnits: 20,
    });
    const products = [product({ refillPriceCents: 5000 })];
    const order = price([full('p00', 1)], [p3], products);
    expect(order.lines[0]).toMatchObject({
      listPriceCents: 18500,
      discountCents: 13500,
      totalCents: 5000,
    });
  });

  it('applies a percentage (P2) per unit, rounded in favour of the customer', () => {
    const p2 = promotion({ deal: { type: 'percentOff', percent: 15 }, productIds: ['p00'] });
    const products = [product({ refillPriceCents: 5150 })];
    const order = price([refill('p00', 2)], [p2], products);
    expect(order.lines[0]).toMatchObject({ discountCents: 1546, totalCents: 8754 });
  });

  it('applies "S/ 5 menos" to every product it names', () => {
    const off = promotion({
      deal: { type: 'amountOff', amountCents: 500 },
      productIds: ['p00', 'p01'],
      maxUnitsPerOrder: 3,
    });
    const order = price([refill('p00', 1), refill('p01', 1)], [off]);
    expect(order.lines.map((line) => line.totalCents)).toEqual([4700, 18500]);
  });

  it('applies "lleva 2, paga 1" (P5) and charges the third unit at list price', () => {
    const p5 = promotion({
      deal: { type: 'buyXPayY', buyUnits: 2, payUnits: 1 },
      maxUnitsPerOrder: 2,
      totalUnits: 50,
    });
    const order = price([refill('p00', 3)], [p5]);
    expect(order.lines.map((line) => [line.quantity, line.discountCents, line.totalCents])).toEqual(
      [
        [2, 5200, 5200],
        [1, 0, 5200],
      ],
    );
  });

  it('gives nothing in "lleva 3, paga 2" for fewer than three units', () => {
    const p5 = promotion({
      deal: { type: 'buyXPayY', buyUnits: 3, payUnits: 2 },
      maxUnitsPerOrder: 3,
      totalUnits: 50,
    });
    const order = price([refill('p00', 2)], [p5]);
    expect(order.lines).toEqual([
      expect.objectContaining({ quantity: 2, discountCents: 0, promotionId: null }),
    ]);
  });

  it('never leaves a line at zero or below for a per-unit deal', () => {
    const tooMuch = promotion({ deal: { type: 'amountOff', amountCents: 5200 } });
    expect(price([refill('p00', 1)], [tooMuch]).totalCents).toBe(5200);
  });

  // glp-domain §6, invariant 11.
  it.each([
    ['saved without publishing', { active: false }],
    ['scheduled', { startsAt: at(DAY) }],
    ['ended', { endsAt: NOW }],
    ['switched off', { active: false, switchedOffAt: at(-1) }],
    ['sold out', { totalUnits: 3, soldUnits: 3 }],
  ])('does not apply a promotion %s', (_case, change) => {
    expect(price([refill('p00', 1)], [promotion(change)]).discountCents).toBe(0);
  });

  it('does not apply a promotion to a product its lock does not cover', () => {
    const products = [product({ promotedUntil: null })];
    expect(price([refill('p00', 1)], [promotion()], products).discountCents).toBe(0);
  });
});

// glp-domain §6, invariant 12.
describe('priceOrder with several promotions', () => {
  const p1 = promotion({ id: 'o00' });
  const fiveOff = promotion({ id: 'o01', deal: { type: 'amountOff', amountCents: 500 } });

  it('never puts two promotions on the same units: the cheaper one wins', () => {
    const order = price([refill('p00', 1)], [p1, fiveOff]);
    expect(order.lines).toEqual([
      expect.objectContaining({ promotionId: 'o01', totalCents: 4700 }),
    ]);
    expect(order.discountCents).toBe(500);
  });

  it('breaks a tie by slot, whatever the order they arrive in', () => {
    const same = promotion({
      id: 'o05',
      deal: { type: 'fixedPrice', priceSource: 'own', priceCents: 4800 },
    });
    const order = price([refill('p00', 1)], [same, p1]);
    expect(order.lines[0]?.promotionId).toBe('o00');
  });

  it('compares the whole line: more units at a smaller discount can win', () => {
    const oneOnly = promotion({
      id: 'o00',
      deal: { type: 'amountOff', amountCents: 700 },
      maxUnitsPerOrder: 1,
    });
    const two = promotion({
      id: 'o01',
      deal: { type: 'amountOff', amountCents: 400 },
      maxUnitsPerOrder: 2,
    });
    const order = price([refill('p00', 2)], [oneOnly, two]);
    expect(order.lines).toEqual([
      expect.objectContaining({ quantity: 2, discountCents: 800, promotionId: 'o01' }),
    ]);
  });

  it('shares the cap per order across lines, the dearest line first', () => {
    const tenOff = promotion({
      deal: { type: 'percentOff', percent: 10 },
      productIds: ['p00', 'p01'],
      maxUnitsPerOrder: 1,
    });
    const order = price([refill('p00', 1), refill('p01', 1)], [tenOff]);
    expect(order.lines.map((line) => [line.productId, line.discountCents])).toEqual([
      ['p00', 0],
      ['p01', 1900],
    ]);
  });

  it('keeps the order of the lines as asked', () => {
    const order = price([refill('p02', 1), refill('p01', 1), refill('p00', 1)]);
    expect(order.lines.map((line) => line.productId)).toEqual(['p02', 'p01', 'p00']);
  });

  it('adds up to exactly the sum of its lines', () => {
    const order = price([refill('p00', 3), refill('p01', 2), full('p02', 1)], [p1, fiveOff]);
    const sum = order.lines.reduce((total, line) => total + line.totalCents, 0);
    expect(order.totalCents).toBe(sum);
    expect(order.listTotalCents - order.discountCents).toBe(order.totalCents);
  });
});
