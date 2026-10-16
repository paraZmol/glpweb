// Marketing H5 and §3.5: no invented urgency in the conditions.
import { describe, expect, it } from 'vitest';
import { checkConditions, hasBlockedPhrase } from './conditions';
import { PROMOTION_CONDITIONS_MAX_LENGTH } from './constants';
import { canManagePromotions } from './permissions';
import { locksToRaise } from './price-lock';
import { at, DAY, product } from '../../../tests/support/pricing-fixtures';

describe('hasBlockedPhrase', () => {
  it.each([
    'Hasta agotar stock',
    'válido HASTA   AGOTAR existencias',
    'Últimas unidades',
    'ultimas unidades',
    'Unidades limitadas',
    'Quedan pocas, ¡apúrate!',
  ])('finds one in "%s"', (text) => {
    expect(hasBlockedPhrase(text)).toBe(true);
  });

  it.each(['Solo pedidos por Hornilla', 'Unidades por pedido: 2', 'Hasta el domingo'])(
    'lets "%s" through',
    (text) => {
      expect(hasBlockedPhrase(text)).toBe(false);
    },
  );
});

describe('checkConditions', () => {
  it.each([
    ['', null],
    ['Solo pedidos por Hornilla.', null],
    ['C'.repeat(PROMOTION_CONDITIONS_MAX_LENGTH), null],
    ['C'.repeat(PROMOTION_CONDITIONS_MAX_LENGTH + 1), 'tooLong'],
    ['hasta agotar stock', 'blockedPhrase'],
    ['Solo​web', 'invalid'],
    ['¡!', 'invalid'],
  ])('answers "%s" with %s', (text, expected) => {
    expect(checkConditions(text)).toBe(expected);
  });
});

describe('canManagePromotions', () => {
  it.each([
    ['owner', true],
    ['dispatcher', false],
    ['driver', false],
  ] as const)('says %s is %s', (role, expected) => {
    expect(canManagePromotions(role)).toBe(expected);
  });
});

describe('locksToRaise', () => {
  const products = [
    product({ id: 'p00', promotedUntil: at(3 * DAY) }),
    product({ id: 'p01', promotedUntil: at(9 * DAY) }),
    product({ id: 'p02', promotedUntil: null }),
    product({ id: 'p03', promotedUntil: undefined }),
  ];

  it('raises only the named products whose lock falls short', () => {
    expect(locksToRaise(products, ['p00', 'p01', 'p02', 'p03'], at(7 * DAY))).toEqual([
      'p00',
      'p02',
      'p03',
    ]);
  });

  it('leaves alone a lock that already reaches the end', () => {
    expect(locksToRaise(products, ['p00'], at(3 * DAY))).toEqual([]);
  });
});
