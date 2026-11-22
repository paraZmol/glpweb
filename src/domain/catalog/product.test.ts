import { describe, expect, it } from 'vitest';
import {
  defaultProductName,
  productTitle,
  breaksPromotionLock,
  isPriceLocked,
  raisesListPrice,
  sellsFullCylinder,
  toProductOffer,
  type Product,
} from './product';

const PRODUCT: Product = {
  id: 'p00',
  brand: 'Marca Uno',
  brandColor: '#1757d6',
  weightKg: 45,
  name: 'Balón 45 kg',
  refillPriceCents: 19000,
  fullPriceCents: null,
  currency: 'PEN',
  active: true,
  sortOrder: 0,
  createdAt: new Date('2026-10-01T12:00:00Z'),
  updatedAt: new Date('2026-10-01T12:00:00Z'),
};

describe('names of a product', () => {
  it('is named after its weight by default', () => {
    expect(defaultProductName(45)).toBe('Balón 45 kg');
  });

  it('is titled with its brand (marketing §2.1)', () => {
    expect(productTitle(PRODUCT)).toBe('Balón 45 kg · Marca Uno');
  });
});

describe('ways of selling a product', () => {
  it('sells the full cylinder only when it has that price', () => {
    expect(sellsFullCylinder(PRODUCT)).toBe(false);
    expect(sellsFullCylinder({ fullPriceCents: 60000 })).toBe(true);
  });

  it('turns into what the product card shows', () => {
    expect(toProductOffer(PRODUCT)).toEqual({
      weightKg: 45,
      name: 'Balón 45 kg',
      brandName: 'Marca Uno',
      brandColor: '#1757d6',
      refillPriceCents: 19000,
      fullPriceCents: null,
      currency: 'PEN',
    });
  });
});

// glp-domain §6, invariant 16 (the rule itself arrives with promotions, PLAN 3.5).
describe('raisesListPrice', () => {
  const BOTH = { refillPriceCents: 5200, fullPriceCents: 18500 };

  it.each([
    ['a higher refill', { refillPriceCents: 5300, fullPriceCents: 18500 }, true],
    ['a higher full price', { refillPriceCents: 5200, fullPriceCents: 18600 }, true],
    ['lower prices', { refillPriceCents: 5000, fullPriceCents: 18000 }, false],
    ['the same prices', BOTH, false],
    [
      'no longer selling the full cylinder',
      { refillPriceCents: 5200, fullPriceCents: null },
      false,
    ],
  ])('says %s is %s', (_case, after, expected) => {
    expect(raisesListPrice(BOTH, after)).toBe(expected);
  });

  it('does not count starting to sell the full cylinder as a raise', () => {
    const before = { refillPriceCents: 5200, fullPriceCents: null };
    expect(raisesListPrice(before, { refillPriceCents: 5200, fullPriceCents: 18500 })).toBe(false);
  });
});

// PLAN 3.5, §11 2026-10-16: what a promotion that covers the product forbids.
describe('breaksPromotionLock', () => {
  const BOTH = { refillPriceCents: 5200, fullPriceCents: 18500 };

  it.each([
    ['a higher refill', { refillPriceCents: 5201, fullPriceCents: 18500 }, true],
    ['a higher full price', { refillPriceCents: 5200, fullPriceCents: 18501 }, true],
    ['no longer selling the full cylinder', { refillPriceCents: 5200, fullPriceCents: null }, true],
    ['lower prices', { refillPriceCents: 5000, fullPriceCents: 18000 }, false],
    ['the same prices', BOTH, false],
  ])('says %s is %s', (_case, after, expected) => {
    expect(breaksPromotionLock(BOTH, after)).toBe(expected);
  });

  it('lets a product start selling the full cylinder', () => {
    const before = { refillPriceCents: 5200, fullPriceCents: null };
    expect(breaksPromotionLock(before, BOTH)).toBe(false);
  });
});

describe('isPriceLocked', () => {
  const NOW = new Date('2026-10-16T15:00:00Z');

  it.each([
    ['a mark still ahead', new Date('2026-10-16T15:00:01Z'), true],
    ['a mark exactly now', NOW, false],
    ['a mark already past', new Date('2026-10-01T00:00:00Z'), false],
    ['no mark', null, false],
    ['a product older than the mark', undefined, false],
  ])('says %s is %s', (_case, promotedUntil, expected) => {
    expect(isPriceLocked({ promotedUntil }, NOW)).toBe(expected);
  });
});
