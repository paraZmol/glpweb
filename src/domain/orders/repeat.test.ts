// PLAN 4.6 ("pedir lo mismo"): what was ordered, never what it cost.
import { describe, expect, it } from 'vitest';
import { repeatOrder } from './repeat';
import { line, P10, P45, product } from './test-fixtures';

describe('repeatOrder', () => {
  it('copies products, sale modes and quantities, without prices', () => {
    const lines = [
      line({ quantity: 2, unitPriceCents: 4000 }),
      line({ saleMode: 'full', quantity: 1 }),
    ];
    expect(repeatOrder(lines, [P10])).toEqual({
      lines: [
        { productId: 'p00', saleMode: 'refill', quantity: 2 },
        { productId: 'p00', saleMode: 'full', quantity: 1 },
      ],
      dropped: [],
    });
  });

  it('joins again the free unit that had a line of its own', () => {
    const lines = [
      line({ promotionId: 'promo-1' }),
      line({ unitPriceCents: 0, discountCents: 5200, promotionId: 'promo-1' }),
    ];
    expect(repeatOrder(lines, [P10]).lines).toEqual([
      { productId: 'p00', saleMode: 'refill', quantity: 2 },
    ]);
  });

  it('drops a product that left the sale, and says which', () => {
    const lines = [line(), line({ productId: 'p01', name: 'Balón 45 kg', weightKg: 45 })];
    const result = repeatOrder(lines, [P10, product('p01', { active: false })]);
    expect(result.lines).toEqual([{ productId: 'p00', saleMode: 'refill', quantity: 1 }]);
    expect(result.dropped).toEqual([
      {
        productId: 'p01',
        saleMode: 'refill',
        brand: 'Marca Uno',
        name: 'Balón 45 kg',
        weightKg: 45,
      },
    ]);
  });

  it('drops a full cylinder the distributor no longer sells, keeping its refill', () => {
    const lines = [line({ productId: 'p01' }), line({ productId: 'p01', saleMode: 'full' })];
    const result = repeatOrder(lines, [P45]);
    expect(result.lines).toEqual([{ productId: 'p01', saleMode: 'refill', quantity: 1 }]);
    expect(result.dropped.map((d) => d.saleMode)).toEqual(['full']);
  });

  it('drops a product that no longer exists in the catalogue, reported once', () => {
    const lines = [line({ productId: 'p09' }), line({ productId: 'p09', promotionId: 'x' })];
    expect(repeatOrder(lines, [P10]).dropped).toHaveLength(1);
  });

  it('returns nothing to order when nothing is sold anymore', () => {
    expect(repeatOrder([line()], []).lines).toEqual([]);
  });
});
