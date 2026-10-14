import { describe, expect, it } from 'vitest';
import {
  freeProductSlot,
  isProductSlot,
  isSameSummary,
  moveInCatalog,
  nextSortOrder,
  planReorder,
  PRODUCT_SLOT_IDS,
  sortCatalog,
  summarizeCatalog,
} from './catalog';
import { MAX_PRODUCTS, MAX_SORT_ORDER } from './constants';
import type { Product } from './product';

const AT = new Date('2026-10-01T12:00:00Z');

function product(id: string, change: Partial<Product> = {}): Product {
  return {
    id,
    brand: 'Marca Uno',
    brandColor: null,
    weightKg: 10,
    name: 'Balón 10 kg',
    refillPriceCents: 5200,
    fullPriceCents: null,
    currency: 'PEN',
    active: true,
    sortOrder: 0,
    createdAt: AT,
    updatedAt: AT,
    ...change,
  };
}

describe('product slots', () => {
  it('has one slot per allowed product, p00 to p29', () => {
    expect(PRODUCT_SLOT_IDS).toHaveLength(MAX_PRODUCTS);
    expect([PRODUCT_SLOT_IDS[0], PRODUCT_SLOT_IDS[MAX_PRODUCTS - 1]]).toEqual(['p00', 'p29']);
  });

  it.each([
    ['p00', true],
    ['p29', true],
    ['p30', false],
    ['p0', false],
    ['P00', false],
    ['abc', false],
  ])('says whether %s is a slot', (id, expected) => {
    expect(isProductSlot(id)).toBe(expected);
  });

  it('gives the first free slot, also a gap left in the middle', () => {
    expect(freeProductSlot([])).toBe('p00');
    expect(freeProductSlot([product('p00'), product('p02')])).toBe('p01');
  });

  it('gives no slot when the catalogue is full', () => {
    expect(freeProductSlot(PRODUCT_SLOT_IDS.map((id) => product(id)))).toBeNull();
  });
});

describe('order of the catalogue', () => {
  it('sorts by the chosen position, then by slot', () => {
    const sorted = sortCatalog([
      product('p02', { sortOrder: 1 }),
      product('p01', { sortOrder: 1 }),
      product('p00', { sortOrder: 5 }),
    ]);
    expect(sorted.map((item) => item.id)).toEqual(['p01', 'p02', 'p00']);
  });

  it('puts a new product last', () => {
    expect(nextSortOrder([])).toBe(0);
    expect(
      nextSortOrder([product('p00', { sortOrder: 4 }), product('p01', { sortOrder: 2 })]),
    ).toBe(5);
  });

  it('never gives a position beyond the cap', () => {
    expect(nextSortOrder([product('p00', { sortOrder: MAX_SORT_ORDER })])).toBe(MAX_SORT_ORDER);
  });

  const LIST = [
    product('p00', { sortOrder: 0 }),
    product('p01', { sortOrder: 1 }),
    product('p02', { sortOrder: 2 }),
  ];

  it.each([
    ['p02', 0, ['p02', 'p00', 'p01']],
    ['p00', 2, ['p01', 'p02', 'p00']],
    ['p00', 99, ['p01', 'p02', 'p00']],
    ['p01', -3, ['p01', 'p00', 'p02']],
    ['p09', 0, ['p00', 'p01', 'p02']],
  ] as const)('moves %s to position %i', (id, toIndex, expected) => {
    expect(moveInCatalog(LIST, id, toIndex)).toEqual(expected);
  });

  it('writes only the products whose position changes', () => {
    const scattered = [
      product('p00', { sortOrder: 0 }),
      product('p01', { sortOrder: 7 }),
      product('p02', { sortOrder: 2 }),
    ];
    expect(planReorder(scattered, ['p00', 'p01', 'p02'])).toEqual([{ id: 'p01', sortOrder: 1 }]);
  });

  it('writes nothing when the order is already the one asked for', () => {
    expect(planReorder(LIST, ['p00', 'p01', 'p02'])).toEqual([]);
  });

  it.each([
    ['a product is missing', ['p00', 'p01']],
    ['a product is unknown', ['p00', 'p01', 'p09']],
    ['a product is repeated', ['p00', 'p01', 'p01']],
  ])('refuses an order where %s', (_case, ids) => {
    expect(planReorder(LIST, ids)).toBeNull();
  });
});

describe('summarizeCatalog', () => {
  it('gives the brands on sale in the chosen order and the cheapest refill', () => {
    const summary = summarizeCatalog([
      product('p00', { brand: 'Marca Dos', sortOrder: 1, refillPriceCents: 5200 }),
      product('p01', { brand: 'Marca Uno', sortOrder: 0, refillPriceCents: 4800 }),
      product('p02', { brand: 'Marca Dos', sortOrder: 2, refillPriceCents: 3800 }),
    ]);
    expect(summary).toEqual({ brands: ['Marca Uno', 'Marca Dos'], priceFromCents: 3800 });
  });

  it('ignores products that are not on sale', () => {
    const summary = summarizeCatalog([
      product('p00', { brand: 'Marca Tres', refillPriceCents: 100, active: false }),
      product('p01', { refillPriceCents: 5200 }),
    ]);
    expect(summary).toEqual({ brands: ['Marca Uno'], priceFromCents: 5200 });
  });

  it('never takes the "from" price from a full cylinder', () => {
    const summary = summarizeCatalog([
      product('p00', { refillPriceCents: 5200, fullPriceCents: 5300 }),
    ]);
    expect(summary.priceFromCents).toBe(5200);
  });

  it('is empty without products on sale', () => {
    expect(summarizeCatalog([product('p00', { active: false })])).toEqual({
      brands: [],
      priceFromCents: null,
    });
  });

  it('keeps at most eight brands, the ones shown first', () => {
    const many = Array.from({ length: 10 }, (_, index) =>
      product(PRODUCT_SLOT_IDS[index] ?? '', { brand: `Marca ${index}`, sortOrder: index }),
    );
    expect(summarizeCatalog(many).brands).toEqual(
      Array.from({ length: 8 }, (_, index) => `Marca ${index}`),
    );
  });

  it('compares two summaries', () => {
    const one = { brands: ['Marca Uno'], priceFromCents: 3800 };
    expect(isSameSummary(one, { brands: ['Marca Uno'], priceFromCents: 3800 })).toBe(true);
    expect(isSameSummary(one, { brands: ['Marca Uno'], priceFromCents: 3900 })).toBe(false);
    expect(isSameSummary(one, { brands: ['Marca Dos'], priceFromCents: 3800 })).toBe(false);
    expect(isSameSummary(one, { brands: [], priceFromCents: 3800 })).toBe(false);
  });
});
