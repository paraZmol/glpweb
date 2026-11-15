import { describe, expect, it } from 'vitest';
import { PriceLockedError } from '../../domain/catalog/errors';
import { PromotionNotEditableError, PromotionsFullError } from '../../domain/pricing/errors';
import { CATALOG } from '../../../tests/support/pricing-fixtures';
import {
  dealProblemOf,
  describePromotionError,
  describePromotionIssue,
} from './promotion-messages';

describe('promotion messages', () => {
  it('says the blocked phrase cannot be used (marketing §4)', () => {
    expect(describePromotionIssue({ field: 'conditions', code: 'blockedPhrase' })).toMatch(
      /Hornilla no cuenta unidades/,
    );
  });

  it.each([
    [new PromotionsFullError(20), /hasta 20 promociones/],
    [new PromotionNotEditableError('switchedOff'), /Repetir/],
    [new PriceLockedError(new Date()), /promoción/],
  ])('describes %s', (error, expected) => {
    expect(describePromotionError(error)).toMatch(expected);
  });
});

describe('dealProblemOf', () => {
  const tenKg = CATALOG.filter((product) => product.id === 'p00');

  it('refuses a rebate that reaches the price, with the most it can be', () => {
    expect(dealProblemOf({ type: 'amountOff', amountCents: 6000 }, tenKg, 'refill')).toBe(
      'La rebaja no puede ser igual o mayor que el precio de un producto elegido: como máximo S/ 51.99.',
    );
  });

  it('measures the most against the cheapest product chosen', () => {
    expect(dealProblemOf({ type: 'amountOff', amountCents: 5200 }, CATALOG, 'refill')).toMatch(
      /como máximo S\/ 27\.99\.$/,
    );
  });

  it('says nothing for a rebate below every price, or before a product is chosen', () => {
    expect(dealProblemOf({ type: 'amountOff', amountCents: 500 }, tenKg, 'refill')).toBeNull();
    expect(dealProblemOf({ type: 'amountOff', amountCents: 6000 }, [], 'refill')).toBeNull();
  });

  it('says what range a rebate of S/ 0 is out of', () => {
    expect(describePromotionIssue({ field: 'amountCents', code: 'outOfRange' })).toMatch(
      /mayor que S\/ 0\.00/,
    );
  });
});
