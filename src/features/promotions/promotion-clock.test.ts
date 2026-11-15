import { describe, expect, it } from 'vitest';
import { NOW, at, promotion } from '../../../tests/support/pricing-fixtures';
import { nowAfter } from './promotion-clock';

describe('nowAfter', () => {
  it('keeps the moment the screen opened when nothing was written later', () => {
    expect(nowAfter(NOW, [promotion({ updatedAt: at(-1000) })])).toEqual(NOW);
  });

  it('moves to the server time of a promotion written after the screen opened', () => {
    expect(nowAfter(NOW, [promotion({ updatedAt: at(5000) })])).toEqual(at(5000));
  });
});
