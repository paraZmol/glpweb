// PLAN 3.5: when a promotion lowers the price of a product, and by how much.
import { describe, expect, it } from 'vitest';
import { at, DAY, NOW, product, promotion } from '../../../tests/support/pricing-fixtures';
import { appliesTo, discountOf, isCoveredBy, listPriceOf, unitPromoPriceCents } from './discount';
import type { PromotionDeal } from './promotion';

describe('listPriceOf', () => {
  it('is the refill or the full price', () => {
    expect(listPriceOf(product(), 'refill')).toBe(5200);
    expect(listPriceOf(product(), 'full')).toBe(18500);
  });

  it('is null for a full cylinder the distributor does not sell', () => {
    expect(listPriceOf(product({ fullPriceCents: null }), 'full')).toBeNull();
  });
});

// PLAN §11, 2026-10-16: a promotion applies only where the price lock reaches its end.
describe('isCoveredBy', () => {
  const ends = { endsAt: at(7 * DAY) };

  it.each([
    ['a lock up to its end', at(7 * DAY), true],
    ['a lock beyond its end', at(9 * DAY), true],
    ['a lock that stops short', at(7 * DAY - 1), false],
    ['no lock', null, false],
    ['a product older than the lock', undefined, false],
  ])('says %s is %s', (_case, promotedUntil, expected) => {
    expect(isCoveredBy(product({ promotedUntil }), ends)).toBe(expected);
  });
});

describe('unitPromoPriceCents', () => {
  it.each([
    ['a special price', { type: 'fixedPrice', priceSource: 'own', priceCents: 4800 }, 5200, 4800],
    ['the refill price of today', { type: 'fixedPrice', priceSource: 'refill' }, 18500, 5200],
    ['10 % off S/ 52.00', { type: 'percentOff', percent: 10 }, 5200, 4680],
    // 15 % of 51.50 is 7.725: the discount goes up to 7.73 (in favour of the customer).
    [
      '15 % off S/ 51.50, rounded for the customer',
      { type: 'percentOff', percent: 15 },
      5150,
      4377,
    ],
    ['30 % off one cent', { type: 'percentOff', percent: 30 }, 1, 0],
    ['S/ 5 off', { type: 'amountOff', amountCents: 500 }, 5200, 4700],
    ['nothing per unit for 2×1', { type: 'buyXPayY', buyUnits: 2, payUnits: 1 }, 5200, null],
  ] as const)('gives %s', (_case, deal, list, expected) => {
    expect(unitPromoPriceCents(deal, product(), list)).toBe(expected);
  });
});

// glp-domain §6, invariant 11, and marketing H2.
describe('appliesTo', () => {
  const applies = (change = {}, productChange = {}, saleMode: 'refill' | 'full' = 'refill') =>
    appliesTo(promotion(change), product(productChange), saleMode, NOW);

  it('applies a live promotion to its product and way of selling', () => {
    expect(applies()).toBe(true);
  });

  it.each([
    ['saved without publishing', { active: false }],
    ['scheduled', { startsAt: at(1) }],
    ['ended', { endsAt: NOW }],
    ['switched off', { active: false, switchedOffAt: at(-1) }],
    ['sold out', { totalUnits: 5, soldUnits: 5 }],
    ['for another product', { productIds: ['p01'] }],
    ['for the other way of selling', { saleMode: 'full' }],
    [
      'with a special price equal to the list price',
      { deal: { type: 'fixedPrice', priceSource: 'own', priceCents: 5200 } },
    ],
    [
      'with a special price above the list price',
      { deal: { type: 'fixedPrice', priceSource: 'own', priceCents: 5300 } },
    ],
    ['with a discount as large as the price', { deal: { type: 'amountOff', amountCents: 5200 } }],
    ['with a discount larger than the price', { deal: { type: 'amountOff', amountCents: 9000 } }],
  ])('does not apply one %s', (_case, change) => {
    expect(applies(change)).toBe(false);
  });

  it.each([
    ['off sale', { active: false }],
    ['without the lock', { promotedUntil: null }],
    ['locked short of the end', { promotedUntil: at(DAY) }],
  ])('does not apply to a product %s', (_case, productChange) => {
    expect(applies({}, productChange)).toBe(false);
  });

  it('does not apply to a full cylinder the distributor does not sell', () => {
    const fullDeal = { saleMode: 'full', deal: { type: 'fixedPrice', priceSource: 'refill' } };
    expect(applies(fullDeal, { fullPriceCents: null }, 'full')).toBe(false);
  });

  it('applies the full cylinder at the price of gas', () => {
    const fullDeal = { saleMode: 'full', deal: { type: 'fixedPrice', priceSource: 'refill' } };
    expect(applies(fullDeal, {}, 'full')).toBe(true);
  });

  it('applies a price of one cent, never zero', () => {
    const special = (priceCents: number) => ({
      deal: { type: 'fixedPrice', priceSource: 'own', priceCents },
    });
    expect(applies(special(1))).toBe(true);
    expect(applies(special(0))).toBe(false);
    expect(applies(special(-100))).toBe(false);
  });

  it('applies 2×1 though its free unit costs nothing', () => {
    expect(applies({ deal: { type: 'buyXPayY', buyUnits: 2, payUnits: 1 } })).toBe(true);
  });
});

describe('discountOf', () => {
  const twoForOne: PromotionDeal = { type: 'buyXPayY', buyUnits: 2, payUnits: 1 };
  const threeForTwo: PromotionDeal = { type: 'buyXPayY', buyUnits: 3, payUnits: 2 };

  it.each([
    [twoForOne, 1, 0, 0],
    [twoForOne, 2, 2, 5200],
    [twoForOne, 3, 2, 5200],
    [twoForOne, 4, 4, 10400],
    [threeForTwo, 2, 0, 0],
    [threeForTwo, 3, 3, 5200],
    [threeForTwo, 5, 3, 5200],
    [threeForTwo, 6, 6, 10400],
  ])('%o of %i units takes %i units and %i cents', (deal, units, taken, cents) => {
    expect(discountOf(deal, product(), 5200, units)).toEqual({
      units: taken,
      discountCents: cents,
    });
  });

  it('discounts every unit of a per-unit deal', () => {
    const deal: PromotionDeal = { type: 'amountOff', amountCents: 500 };
    expect(discountOf(deal, product(), 5200, 3)).toEqual({ units: 3, discountCents: 1500 });
  });

  it('gives nothing for zero units', () => {
    const deal: PromotionDeal = { type: 'percentOff', percent: 10 };
    expect(discountOf(deal, product(), 5200, 0)).toEqual({ units: 0, discountCents: 0 });
  });
});
