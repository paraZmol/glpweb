import { describe, expect, it } from 'vitest';
import { availableSaleMode, priceCentsOf, type ProductOffer } from './sale-mode';

const WITH_CYLINDER: ProductOffer = {
  weightKg: 10,
  brandName: 'Marca Uno',
  brandColor: '#1757d6',
  refillPriceCents: 5200,
  fullPriceCents: 18500,
  currency: 'PEN',
};
const REFILL_ONLY: ProductOffer = { ...WITH_CYLINDER, fullPriceCents: null };

// Decision of 2026-10-10: refill and full cylinder, each with its own price.
describe('sale modes of a product', () => {
  it('offers both modes when the product has both prices', () => {
    expect(availableSaleMode(WITH_CYLINDER, 'refill')).toBe('refill');
    expect(availableSaleMode(WITH_CYLINDER, 'full')).toBe('full');
  });

  it('falls back to refill when the distributor does not sell the cylinder', () => {
    expect(availableSaleMode(REFILL_ONLY, 'full')).toBe('refill');
  });

  it.each([
    ['refill', WITH_CYLINDER, 5200],
    ['full', WITH_CYLINDER, 18500],
    ['refill', REFILL_ONLY, 5200],
    ['full', REFILL_ONLY, 5200],
  ] as const)('prices %s of that product', (mode, product, cents) => {
    expect(priceCentsOf(product, mode)).toBe(cents);
  });
});
