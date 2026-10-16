import { describe, expect, it } from 'vitest';
import { SEED_DISTRIBUTORS } from '../../../tests/seed/data';
import { isProductSlot, summarizeCatalog } from './catalog';
import { prepareNewProduct } from './product-input';

// The seed writes the profile and the catalogue by hand (rules disabled): they must agree the
// way the app keeps them, or a test would pass against a world the app can never reach.
describe.each(Object.values(SEED_DISTRIBUTORS))('seeded catalogue of $name', (distributor) => {
  it('repeats in the profile the brands on sale and the cheapest refill with its weight', () => {
    expect(summarizeCatalog(distributor.products)).toEqual({
      brands: distributor.brands,
      priceFromCents: distributor.priceFromCents,
      priceFromWeightKg: distributor.priceFromWeightKg,
    });
  });

  it('holds only products the app could have written', () => {
    for (const { id, sortOrder: _sortOrder, ...product } of distributor.products) {
      expect(isProductSlot(id)).toBe(true);
      expect(prepareNewProduct(product)).toEqual({ ok: true, value: product });
    }
  });
});
