// PLAN 3.5: the preview and the warning of what the owner stops charging (marketing §4, step 3).
import { describe, expect, it } from 'vitest';
import { CATALOG, product } from '../../../tests/support/pricing-fixtures';
import { previewPromotion } from './preview';
import type { PromotionDeal } from './promotion';

const ten = product();

describe('previewPromotion', () => {
  it('shows "S/ 52.00 → S/ 48.00" and 8 % for the special price of marketing P1', () => {
    const deal: PromotionDeal = { type: 'fixedPrice', priceSource: 'own', priceCents: 4800 };
    expect(previewPromotion(deal, [ten], 'refill')).toEqual({
      rows: [
        {
          productId: 'p00',
          listPriceCents: 5200,
          promoTotalCents: 4800,
          units: 1,
          discountCents: 400,
          percent: 8,
          level: 'normal',
        },
      ],
      level: 'normal',
    });
  });

  it.each([
    ['15 % is normal', { type: 'percentOff', percent: 15 }, 'normal'],
    ['20 % calls for attention', { type: 'percentOff', percent: 20 }, 'attention'],
    ['30 % calls for attention', { type: 'percentOff', percent: 30 }, 'attention'],
    ['"lleva 2, paga 1" is a risk', { type: 'buyXPayY', buyUnits: 2, payUnits: 1 }, 'risk'],
    ['"lleva 3, paga 2" (34 %) is a risk', { type: 'buyXPayY', buyUnits: 3, payUnits: 2 }, 'risk'],
  ] as const)('%s', (_case, deal, level) => {
    expect(previewPromotion(deal, [ten], 'refill').level).toBe(level);
  });

  it('warns of the risk of giving the container away (P3), with 72 % rounded up', () => {
    const deal: PromotionDeal = { type: 'fixedPrice', priceSource: 'refill' };
    const { rows, level } = previewPromotion(deal, [ten], 'full');
    expect(rows[0]).toMatchObject({
      listPriceCents: 18500,
      promoTotalCents: 5200,
      discountCents: 13300,
      percent: 72,
    });
    expect(level).toBe('risk');
  });

  it('prices a group of "lleva 3, paga 2"', () => {
    const deal: PromotionDeal = { type: 'buyXPayY', buyUnits: 3, payUnits: 2 };
    expect(previewPromotion(deal, [ten], 'refill').rows[0]).toMatchObject({
      units: 3,
      promoTotalCents: 10400,
      discountCents: 5200,
      percent: 34,
    });
  });

  it('puts the largest discount first and leaves out what is not sold that way', () => {
    const deal: PromotionDeal = { type: 'percentOff', percent: 10 };
    expect(previewPromotion(deal, CATALOG, 'full').rows.map((row) => row.productId)).toEqual([
      'p00',
      'p02',
    ]);
    expect(previewPromotion(deal, CATALOG, 'refill').rows.map((row) => row.discountCents)).toEqual([
      1900, 520, 280,
    ]);
  });

  it('is normal and empty without products', () => {
    expect(previewPromotion({ type: 'percentOff', percent: 10 }, [], 'refill')).toEqual({
      rows: [],
      level: 'normal',
    });
  });
});
