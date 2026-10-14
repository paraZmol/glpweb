import { describe, expect, it } from 'vitest';
import { MAX_PRICE_CENTS, MAX_WEIGHT_KG, PRODUCT_NAME_MAX_LENGTH } from './constants';
import type { Product } from './product';
import { prepareNewProduct, prepareProductEdit, type ProductInput } from './product-input';

// PLAN 3.1: products and prices, recarga and balón completo per product.
const INPUT: ProductInput = {
  brand: 'Marca Uno',
  brandColor: '#1757D6',
  weightKg: 10,
  refillPriceCents: 5200,
  fullPriceCents: 18500,
};

const STORED: Product = {
  id: 'p00',
  brand: 'Marca Uno',
  brandColor: null,
  weightKg: 10,
  name: 'Balón 10 kg',
  refillPriceCents: 5200,
  fullPriceCents: 18500,
  currency: 'PEN',
  active: true,
  sortOrder: 0,
  createdAt: new Date('2026-10-01T12:00:00Z'),
  updatedAt: new Date('2026-10-01T12:00:00Z'),
};

const fieldsWithIssues = (result: ReturnType<typeof prepareNewProduct>) =>
  result.ok ? [] : result.issues.map((issue) => `${issue.field}:${issue.code}`);

describe('prepareNewProduct', () => {
  it('accepts a product with both ways of selling and names it after its weight', () => {
    const result = prepareNewProduct(INPUT);
    expect(result).toEqual({
      ok: true,
      value: {
        brand: 'Marca Uno',
        brandColor: '#1757d6',
        weightKg: 10,
        name: 'Balón 10 kg',
        refillPriceCents: 5200,
        fullPriceCents: 18500,
        active: true,
      },
    });
  });

  it('accepts a product sold only as a refill', () => {
    const result = prepareNewProduct({ ...INPUT, fullPriceCents: null });
    expect(result.ok && result.value.fullPriceCents).toBeNull();
  });

  it('tidies the texts and keeps a name the owner wrote', () => {
    const result = prepareNewProduct({
      ...INPUT,
      brand: '  Marca   Ñandú ',
      name: ' Balón  grande ',
    });
    expect(result.ok && [result.value.brand, result.value.name]).toEqual([
      'Marca Ñandú',
      'Balón grande',
    ]);
  });

  it('treats an empty colour as none', () => {
    const result = prepareNewProduct({ ...INPUT, brandColor: '  ' });
    expect(result.ok && result.value.brandColor).toBeNull();
  });

  it('can create a product that is not on sale yet', () => {
    const result = prepareNewProduct({ ...INPUT, active: false });
    expect(result.ok && result.value.active).toBe(false);
  });

  it.each([
    ['a missing brand', { brand: '   ' }, 'brand:required'],
    ['a brand too long', { brand: 'M'.repeat(31) }, 'brand:tooLong'],
    ['a colour that is not #rrggbb', { brandColor: 'blue' }, 'brandColor:invalid'],
    ['a weight of zero', { weightKg: 0 }, 'weightKg:outOfRange'],
    ['a weight above the cap', { weightKg: MAX_WEIGHT_KG + 1 }, 'weightKg:outOfRange'],
    ['a weight with decimals', { weightKg: 10.5 }, 'weightKg:invalid'],
    ['a name too long', { name: 'N'.repeat(PRODUCT_NAME_MAX_LENGTH + 1) }, 'name:tooLong'],
    ['a one-letter name', { name: 'B' }, 'name:tooShort'],
    ['a refill price of zero', { refillPriceCents: 0 }, 'refillPriceCents:outOfRange'],
    ['a negative refill price', { refillPriceCents: -5200 }, 'refillPriceCents:outOfRange'],
    [
      'a refill price in soles with decimals',
      { refillPriceCents: 52.5 },
      'refillPriceCents:invalid',
    ],
    [
      'a refill price above S/ 999',
      { refillPriceCents: MAX_PRICE_CENTS + 1, fullPriceCents: null },
      'refillPriceCents:outOfRange',
    ],
    [
      'a full price above S/ 999',
      { fullPriceCents: MAX_PRICE_CENTS + 1 },
      'fullPriceCents:outOfRange',
    ],
    ['a full price that is not an integer', { fullPriceCents: 18500.5 }, 'fullPriceCents:invalid'],
    ['a full price equal to the refill', { fullPriceCents: 5200 }, 'fullPriceCents:notAbove'],
    ['a full price below the refill', { fullPriceCents: 5100 }, 'fullPriceCents:notAbove'],
  ] as const)('rejects %s', (_case, change, issue) => {
    expect(fieldsWithIssues(prepareNewProduct({ ...INPUT, ...change }))).toEqual([issue]);
  });

  it('accepts the highest price the cap allows', () => {
    const result = prepareNewProduct({
      ...INPUT,
      refillPriceCents: 1,
      fullPriceCents: MAX_PRICE_CENTS,
    });
    expect(result.ok).toBe(true);
  });
});

describe('prepareProductEdit', () => {
  it('keeps only what changes', () => {
    const result = prepareProductEdit(STORED, { brand: 'Marca Uno', refillPriceCents: 5400 });
    expect(result).toEqual({ ok: true, value: { refillPriceCents: 5400 } });
  });

  it('returns nothing when nothing changes', () => {
    expect(prepareProductEdit(STORED, { name: ' Balón 10 kg ', active: true })).toEqual({
      ok: true,
      value: {},
    });
  });

  it('stops selling the full cylinder with a null price', () => {
    expect(prepareProductEdit(STORED, { fullPriceCents: null })).toEqual({
      ok: true,
      value: { fullPriceCents: null },
    });
  });

  it('refuses a refill raised above the full price already stored', () => {
    const result = prepareProductEdit(STORED, { refillPriceCents: 18500 });
    expect(result.ok ? [] : result.issues).toEqual([{ field: 'fullPriceCents', code: 'notAbove' }]);
  });

  it('refuses a full price lowered below the stored refill', () => {
    const result = prepareProductEdit(STORED, { fullPriceCents: 4000 });
    expect(result.ok ? [] : result.issues).toEqual([{ field: 'fullPriceCents', code: 'notAbove' }]);
  });

  it('accepts both prices moving together in the same edit', () => {
    const result = prepareProductEdit(STORED, { refillPriceCents: 19000, fullPriceCents: 25000 });
    expect(result.ok).toBe(true);
  });

  it('validates the new values', () => {
    const result = prepareProductEdit(STORED, { brand: '', refillPriceCents: 0.5 });
    expect(result.ok ? [] : result.issues.map((issue) => issue.field)).toEqual([
      'brand',
      'refillPriceCents',
    ]);
  });
});
