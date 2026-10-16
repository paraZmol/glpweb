import { describe, expect, it } from 'vitest';
import { PriceLockedError } from '../../domain/catalog/errors';
import { PromotionNotEditableError, PromotionsFullError } from '../../domain/pricing/errors';
import { describePromotionError, describePromotionIssue } from './promotion-messages';

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
