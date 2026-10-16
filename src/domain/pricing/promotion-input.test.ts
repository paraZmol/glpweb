// PLAN 3.5: "Añadir promoción" — what the form accepts (marketing §4, D5, D6, D15).
import { describe, expect, it } from 'vitest';
import { at, CATALOG, DAY, NOW, product } from '../../../tests/support/pricing-fixtures';
import {
  MAX_PERCENT_OFF,
  MAX_PROMOTION_DAYS,
  MAX_SCHEDULE_AHEAD_DAYS,
  MAX_TOTAL_UNITS,
  MAX_UNITS_PER_ORDER,
  PROMOTION_CONDITIONS_MAX_LENGTH,
  PROMOTION_TITLE_MAX_LENGTH,
} from './constants';
import type { PromotionDeal } from './promotion';
import { preparePromotion, type PromotionInput, windowIssues } from './promotion-input';

const catalog = [...CATALOG, product({ id: 'p03', active: false })];

function input(change: Partial<PromotionInput> = {}): PromotionInput {
  return {
    title: 'Precio especial',
    deal: { type: 'fixedPrice', priceSource: 'own', priceCents: 4800 },
    productIds: ['p00'],
    saleMode: 'refill',
    startsAt: 'now',
    endsAt: at(7 * DAY),
    maxUnitsPerOrder: 2,
    totalUnits: null,
    ...change,
  };
}

const issuesOf = (change: Partial<PromotionInput>) => {
  const result = preparePromotion(input(change), catalog, NOW);
  return result.ok ? [] : result.issues.map((issue) => `${issue.field}:${issue.code}`);
};

describe('preparePromotion — what it accepts', () => {
  const P3 = {
    deal: { type: 'fixedPrice', priceSource: 'refill' },
    saleMode: 'full',
    maxUnitsPerOrder: 1,
    totalUnits: 20,
  } as const;

  it.each([
    ['P1, a special price', {}],
    [
      'P2, a percentage on several products',
      { deal: { type: 'percentOff', percent: 10 }, productIds: ['p00', 'p01', 'p02'] },
    ],
    ['the hardest percentage', { deal: { type: 'percentOff', percent: MAX_PERCENT_OFF } }],
    ['P3, the full cylinder at the price of gas', P3],
    [
      'P4, a full cylinder with a discount',
      {
        deal: { type: 'fixedPrice', priceSource: 'own', priceCents: 16900 },
        saleMode: 'full',
        maxUnitsPerOrder: 1,
      },
    ],
    [
      'P5, "lleva 2, paga 1"',
      { deal: { type: 'buyXPayY', buyUnits: 2, payUnits: 1 }, maxUnitsPerOrder: 2, totalUnits: 50 },
    ],
    [
      'P5, "lleva 3, paga 2" twice per order',
      { deal: { type: 'buyXPayY', buyUnits: 3, payUnits: 2 }, maxUnitsPerOrder: 6, totalUnits: 50 },
    ],
    [
      '"S/ 5 menos" on every product',
      { deal: { type: 'amountOff', amountCents: 500 }, productIds: ['p00', 'p01', 'p02'] },
    ],
    ['a total cap on a special price', { totalUnits: 40 }],
    ['the largest caps', { maxUnitsPerOrder: MAX_UNITS_PER_ORDER, totalUnits: MAX_TOTAL_UNITS }],
    [
      'the longest title and conditions',
      {
        title: 'T'.repeat(PROMOTION_TITLE_MAX_LENGTH),
        conditions: 'C'.repeat(PROMOTION_CONDITIONS_MAX_LENGTH),
      },
    ],
    [
      'conditions with accents and ñ',
      { conditions: 'Solo pedidos por Hornilla en Miraflores y Ñaña' },
    ],
    ['a promotion scheduled for tomorrow', { startsAt: at(DAY), endsAt: at(2 * DAY) }],
    ['the longest validity', { endsAt: at(MAX_PROMOTION_DAYS * DAY) }],
    [
      'the latest start',
      {
        startsAt: at(MAX_SCHEDULE_AHEAD_DAYS * DAY),
        endsAt: at((MAX_SCHEDULE_AHEAD_DAYS + 1) * DAY),
      },
    ],
    ['one saved without publishing', { active: false }],
  ] as const)('accepts %s', (_case, change) => {
    expect(issuesOf(change as Partial<PromotionInput>)).toEqual([]);
  });

  it('tidies the texts and publishes by default', () => {
    const result = preparePromotion(
      input({ title: '  Precio   especial ', conditions: ' Solo  web ' }),
      catalog,
      NOW,
    );
    expect(result).toMatchObject({
      ok: true,
      value: { title: 'Precio especial', conditions: 'Solo web', active: true },
    });
  });

  it('keeps only the parameters of the kind', () => {
    const deal = { type: 'percentOff', percent: 10, priceCents: 1 } as unknown as PromotionDeal;
    const result = preparePromotion(input({ deal, productIds: ['p00'] }), catalog, NOW);
    expect(result.ok && result.value.deal).toEqual({ type: 'percentOff', percent: 10 });
  });
});

describe('preparePromotion — what it refuses', () => {
  it.each([
    ['an empty title', { title: '  ' }, 'title:required'],
    ['a title too long', { title: 'T'.repeat(PROMOTION_TITLE_MAX_LENGTH + 1) }, 'title:tooLong'],
    ['a title of invisible characters', { title: '​' }, 'title:invalid'],
    [
      'conditions too long',
      { conditions: 'C'.repeat(PROMOTION_CONDITIONS_MAX_LENGTH + 1) },
      'conditions:tooLong',
    ],
    [
      '"hasta agotar stock" (H5)',
      { conditions: 'Válido hasta agotar stock' },
      'conditions:blockedPhrase',
    ],
    ['no product', { productIds: [] }, 'productIds:required'],
    [
      'a product twice',
      { deal: { type: 'percentOff', percent: 10 }, productIds: ['p00', 'p00'] },
      'productIds:invalid',
    ],
    [
      'a product off sale',
      { deal: { type: 'percentOff', percent: 10 }, productIds: ['p03'] },
      'productIds:unavailable',
    ],
    ['a product it does not know', { productIds: ['p29'] }, 'productIds:unavailable'],
    ['a special price on two products', { productIds: ['p00', 'p02'] }, 'productIds:outOfRange'],
    [
      'a full cylinder the distributor does not sell',
      { deal: { type: 'percentOff', percent: 10 }, productIds: ['p01'], saleMode: 'full' },
      'saleMode:unavailable',
    ],
    [
      'a special price equal to the list price',
      { deal: { type: 'fixedPrice', priceSource: 'own', priceCents: 5200 } },
      'priceCents:notBelow',
    ],
    [
      'a special price above the list price',
      { deal: { type: 'fixedPrice', priceSource: 'own', priceCents: 5300 } },
      'priceCents:notBelow',
    ],
    [
      'a special price of zero',
      { deal: { type: 'fixedPrice', priceSource: 'own', priceCents: 0 } },
      'priceCents:outOfRange',
    ],
    [
      'a special price with fractions of a cent',
      { deal: { type: 'fixedPrice', priceSource: 'own', priceCents: 4800.5 } },
      'priceCents:invalid',
    ],
    [
      'the price of gas on a refill',
      { deal: { type: 'fixedPrice', priceSource: 'refill' }, maxUnitsPerOrder: 1, totalUnits: 20 },
      'saleMode:invalid',
    ],
    ['a percentage of zero', { deal: { type: 'percentOff', percent: 0 } }, 'percent:outOfRange'],
    [
      'a percentage above 30 (D6)',
      { deal: { type: 'percentOff', percent: MAX_PERCENT_OFF + 1 } },
      'percent:outOfRange',
    ],
    [
      'a percentage with decimals',
      { deal: { type: 'percentOff', percent: 10.5 } },
      'percent:invalid',
    ],
    [
      'an amount as large as a price it covers',
      { deal: { type: 'amountOff', amountCents: 2800 }, productIds: ['p00', 'p02'] },
      'amountCents:notBelow',
    ],
    [
      'an amount of zero',
      { deal: { type: 'amountOff', amountCents: 0 } },
      'amountCents:outOfRange',
    ],
    [
      '"lleva 3, paga 1"',
      { deal: { type: 'buyXPayY', buyUnits: 3, payUnits: 1 }, maxUnitsPerOrder: 3, totalUnits: 9 },
      'buyUnits:invalid',
    ],
    [
      '"lleva 2, paga 1" with 3 per order',
      { deal: { type: 'buyXPayY', buyUnits: 2, payUnits: 1 }, maxUnitsPerOrder: 3, totalUnits: 9 },
      'maxUnitsPerOrder:notMultiple',
    ],
    [
      '"lleva 2, paga 1" without a total cap (D15)',
      { deal: { type: 'buyXPayY', buyUnits: 2, payUnits: 1 }, maxUnitsPerOrder: 2 },
      'totalUnits:required',
    ],
    [
      'the price of gas without a total cap (D5)',
      {
        deal: { type: 'fixedPrice', priceSource: 'refill' },
        saleMode: 'full',
        maxUnitsPerOrder: 1,
      },
      'totalUnits:required',
    ],
    [
      'the price of gas twice per order',
      {
        deal: { type: 'fixedPrice', priceSource: 'refill' },
        saleMode: 'full',
        maxUnitsPerOrder: 2,
        totalUnits: 20,
      },
      'maxUnitsPerOrder:outOfRange',
    ],
    ['no unit per order', { maxUnitsPerOrder: 0 }, 'maxUnitsPerOrder:outOfRange'],
    [
      'more units per order than the cap',
      { maxUnitsPerOrder: MAX_UNITS_PER_ORDER + 1 },
      'maxUnitsPerOrder:outOfRange',
    ],
    ['a total cap of zero', { totalUnits: 0 }, 'totalUnits:outOfRange'],
    ['a total cap above the limit', { totalUnits: MAX_TOTAL_UNITS + 1 }, 'totalUnits:outOfRange'],
    ['a start in the past', { startsAt: at(-1) }, 'startsAt:outOfRange'],
    [
      'a start too far ahead',
      { startsAt: at(MAX_SCHEDULE_AHEAD_DAYS * DAY + 1), endsAt: at(40 * DAY) },
      'startsAt:outOfRange',
    ],
    ['an end before the start', { startsAt: at(DAY), endsAt: at(DAY - 1) }, 'endsAt:notAbove'],
    ['an end equal to the start', { startsAt: at(DAY), endsAt: at(DAY) }, 'endsAt:notAbove'],
    ['an end that already passed', { endsAt: at(-DAY) }, 'endsAt:notAbove'],
    ['more than 30 days (D6)', { endsAt: at(MAX_PROMOTION_DAYS * DAY + 1) }, 'endsAt:outOfRange'],
  ] as const)('refuses %s', (_case, change, expected) => {
    expect(issuesOf(change as Partial<PromotionInput>)).toContain(expected);
  });
});

describe('windowIssues', () => {
  it('measures a start "now" from the time given', () => {
    expect(windowIssues('now', at(MAX_PROMOTION_DAYS * DAY), NOW)).toEqual([]);
  });
});
