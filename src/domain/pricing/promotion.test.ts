// PLAN 3.5: what a saved promotion is, where it stands, and the slot a new one takes.
import { describe, expect, it } from 'vitest';
import { at, DAY, HOUR, NOW, promotion } from '../../../tests/support/pricing-fixtures';
import { MAX_PROMOTIONS } from './constants';
import {
  freePromotionSlot,
  isLive,
  PROMOTION_SLOT_IDS,
  promotionBadge,
  promotionStateOf,
  remainingUnits,
} from './promotion';

describe('promotion slots', () => {
  it('has one slot per promotion alive at once, o00 to o19', () => {
    expect(PROMOTION_SLOT_IDS).toHaveLength(MAX_PROMOTIONS);
    expect(PROMOTION_SLOT_IDS[0]).toBe('o00');
    expect(PROMOTION_SLOT_IDS.at(-1)).toBe('o19');
  });
});

describe('promotionStateOf', () => {
  it.each([
    ['live', {}],
    ['draft', { active: false }],
    ['scheduled', { startsAt: at(HOUR) }],
    ['ended', { endsAt: NOW }],
    ['ended', { endsAt: at(-DAY), active: false }],
    ['switchedOff', { active: false, switchedOffAt: at(-1), switchedOffBy: 'owner-a' }],
    ['soldOut', { totalUnits: 40, soldUnits: 40 }],
    ['live', { totalUnits: 40, soldUnits: 39 }],
    ['live', { startsAt: NOW }],
  ] as const)('says %s for %o', (expected, change) => {
    expect(promotionStateOf(promotion(change), NOW)).toBe(expected);
  });

  it('says switched off even after the end it announced', () => {
    const off = promotion({ active: false, switchedOffAt: at(-DAY), endsAt: at(-HOUR) });
    expect(promotionStateOf(off, NOW)).toBe('switchedOff');
  });
});

// glp-domain §6, invariant 11: an inactive or expired promotion does not apply.
describe('isLive', () => {
  it.each([
    ['published and started', {}, true],
    ['saved without publishing', { active: false }, false],
    ['not started yet', { startsAt: at(1) }, false],
    ['ending exactly now', { endsAt: NOW }, false],
    ['with its total cap reached', { totalUnits: 10, soldUnits: 10 }, false],
    ['with its total cap passed', { totalUnits: 10, soldUnits: 11 }, false],
  ])('says %s is %s', (_case, change, expected) => {
    expect(isLive(promotion(change), NOW)).toBe(expected);
  });
});

describe('remainingUnits', () => {
  it.each([
    [null, 0, null],
    [40, 12, 28],
    [40, 40, 0],
    [40, 45, 0],
  ])('with a cap of %s and %s sold leaves %s', (totalUnits, soldUnits, expected) => {
    expect(remainingUnits({ totalUnits, soldUnits })).toBe(expected);
  });
});

describe('freePromotionSlot', () => {
  const full = (change: (slot: string, index: number) => object = () => ({})) =>
    PROMOTION_SLOT_IDS.map((id, index) => promotion({ id, ...change(id, index) }));

  it('takes the first slot nobody uses', () => {
    expect(freePromotionSlot([promotion({ id: 'o00' }), promotion({ id: 'o02' })], NOW)).toBe(
      'o01',
    );
  });

  it('answers null when twenty promotions are alive', () => {
    expect(freePromotionSlot(full(), NOW)).toBeNull();
  });

  it('never takes the slot of one saved without publishing that has not ended', () => {
    expect(
      freePromotionSlot(
        full(() => ({ active: false })),
        NOW,
      ),
    ).toBeNull();
  });

  it('reuses the slot of the promotion that is over the longest', () => {
    const slots = full((id) =>
      id === 'o07'
        ? { endsAt: at(-2 * DAY) }
        : id === 'o03'
          ? { active: false, switchedOffAt: at(-3 * DAY), endsAt: at(DAY) }
          : {},
    );
    expect(freePromotionSlot(slots, NOW)).toBe('o03');
  });

  it('breaks a tie by slot', () => {
    const slots = full((id) => (id === 'o09' || id === 'o04' ? { endsAt: at(-DAY) } : {}));
    expect(freePromotionSlot(slots, NOW)).toBe('o04');
  });
});

// Marketing §3.1 and H11: the seal is set by the system.
describe('promotionBadge', () => {
  it.each([
    ['Oferta', { type: 'fixedPrice', priceSource: 'own', priceCents: 4800 }],
    ['Con envase al precio del gas', { type: 'fixedPrice', priceSource: 'refill' }],
    ['Oferta', { type: 'percentOff', percent: 10 }],
    ['−S/ 5', { type: 'amountOff', amountCents: 500 }],
    ['−S/ 5.50', { type: 'amountOff', amountCents: 550 }],
    ['−S/ 0.30', { type: 'amountOff', amountCents: 30 }],
    ['2×1', { type: 'buyXPayY', buyUnits: 2, payUnits: 1 }],
    ['3×2', { type: 'buyXPayY', buyUnits: 3, payUnits: 2 }],
  ] as const)('reads %s', (expected, deal) => {
    expect(promotionBadge(deal)).toBe(expected);
  });
});
