// PLAN 4.2 and 3.5: frozen prices, with the promotions calculation injected.
import { describe, expect, it } from 'vitest';
import { PricingMismatchError } from './errors';
import type { LineRequest } from './lines';
import type { OrderPricer, PricedLine } from './pricer';
import { checkPricedLines, freezeLines, listPricer } from './pricer';
import { AT, CATALOG } from './test-fixtures';

const TWO_REFILLS: LineRequest[] = [{ productId: 'p00', saleMode: 'refill', quantity: 2 }];

/** "Lleva 2, paga 1" as 3.5 will return it: the free unit in a line of its own at zero. */
const buyTwoPayOne: OrderPricer = () => [
  {
    productId: 'p00',
    saleMode: 'refill',
    quantity: 1,
    listPriceCents: 5200,
    unitPriceCents: 5200,
    discountCents: 0,
    promotionId: 'promo-1',
  },
  {
    productId: 'p00',
    saleMode: 'refill',
    quantity: 1,
    listPriceCents: 5200,
    unitPriceCents: 0,
    discountCents: 5200,
    promotionId: 'promo-1',
  },
];

const fixed =
  (change: Partial<PricedLine>): OrderPricer =>
  () => [
    {
      productId: 'p00',
      saleMode: 'refill',
      quantity: 2,
      listPriceCents: 5200,
      unitPriceCents: 4800,
      discountCents: 800,
      promotionId: 'promo-2',
      ...change,
    },
  ];

describe('listPricer', () => {
  it('prices every line at its list price, without promotion', () => {
    const lines: LineRequest[] = [
      ...TWO_REFILLS,
      { productId: 'p00', saleMode: 'full', quantity: 1 },
    ];
    expect(listPricer({ lines, products: CATALOG, at: AT })).toEqual([
      {
        ...lines[0],
        listPriceCents: 5200,
        unitPriceCents: 5200,
        discountCents: 0,
        promotionId: null,
      },
      {
        ...lines[1],
        listPriceCents: 18_500,
        unitPriceCents: 18_500,
        discountCents: 0,
        promotionId: null,
      },
    ]);
  });

  it('throws on a full cylinder that is not sold', () => {
    const lines: LineRequest[] = [{ productId: 'p01', saleMode: 'full', quantity: 1 }];
    expect(() => listPricer({ lines, products: CATALOG, at: AT })).toThrow(PricingMismatchError);
  });
});

describe('freezeLines', () => {
  it('copies brand, name and weight of the product into each line', () => {
    const [frozen] = freezeLines({
      lines: TWO_REFILLS,
      products: CATALOG,
      at: AT,
      pricer: listPricer,
    });
    expect(frozen).toMatchObject({
      brand: 'Marca Uno',
      name: 'Balón 10 kg',
      weightKg: 10,
      quantity: 2,
    });
  });

  it('passes the creation time to the pricer: promotions count at that instant', () => {
    const seen: Date[] = [];
    const spy: OrderPricer = (input) => {
      seen.push(input.at);
      return listPricer(input);
    };
    freezeLines({ lines: TWO_REFILLS, products: CATALOG, at: AT, pricer: spy });
    expect(seen).toEqual([AT]);
  });

  it('accepts a free unit in its own line at zero, inside a promotion', () => {
    const lines = freezeLines({
      lines: TWO_REFILLS,
      products: CATALOG,
      at: AT,
      pricer: buyTwoPayOne,
    });
    expect(lines.map((l) => [l.unitPriceCents, l.discountCents])).toEqual([
      [5200, 0],
      [0, 5200],
    ]);
  });

  it('accepts a special price with the discount that follows from it', () => {
    const run = () =>
      freezeLines({ lines: TWO_REFILLS, products: CATALOG, at: AT, pricer: fixed({}) });
    expect(run).not.toThrow();
  });

  it.each([
    ['a list price other than the catalogue', fixed({ listPriceCents: 5000 })],
    ['a unit price above the list price', fixed({ unitPriceCents: 5300, discountCents: -200 })],
    ['a negative unit price', fixed({ unitPriceCents: -1, discountCents: 10_402 })],
    ['a float unit price', fixed({ unitPriceCents: 4800.5, discountCents: 799 })],
    ['a discount that does not follow', fixed({ discountCents: 400 })],
    ['a discount without promotion', fixed({ promotionId: null })],
    [
      'zero without promotion',
      fixed({ unitPriceCents: 0, discountCents: 10_400, promotionId: null }),
    ],
    ['fewer units than asked', fixed({ quantity: 1, discountCents: 400 })],
    ['more units than asked', fixed({ quantity: 3, discountCents: 1200 })],
    [
      'another sale mode',
      fixed({ saleMode: 'full', listPriceCents: 18_500, unitPriceCents: 18_500, discountCents: 0 }),
    ],
    [
      'another product',
      fixed({ productId: 'p01', listPriceCents: 21_000, unitPriceCents: 21_000, discountCents: 0 }),
    ],
    ['a fractional quantity', fixed({ quantity: 1.5, discountCents: 600 })],
  ])('rejects a pricer returning %s', (_case, pricer) => {
    expect(() => freezeLines({ lines: TWO_REFILLS, products: CATALOG, at: AT, pricer })).toThrow(
      PricingMismatchError,
    );
  });

  it('rejects a pricer that drops a line', () => {
    const lines: LineRequest[] = [
      ...TWO_REFILLS,
      { productId: 'p01', saleMode: 'refill', quantity: 1 },
    ];
    const pricer: OrderPricer = (input) => listPricer(input).slice(0, 1);
    expect(() => freezeLines({ lines, products: CATALOG, at: AT, pricer })).toThrow(
      PricingMismatchError,
    );
  });
});

describe('checkPricedLines', () => {
  it('accepts the list pricer on any valid request', () => {
    const priced = listPricer({ lines: TWO_REFILLS, products: CATALOG, at: AT });
    expect(() => checkPricedLines(TWO_REFILLS, priced, CATALOG)).not.toThrow();
  });
});
