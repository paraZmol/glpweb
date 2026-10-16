// PLAN §11, 2026-10-16: the only three things a saved promotion may still do.
import { describe, expect, it } from 'vitest';
import { at, DAY, NOW, promotion } from '../../../tests/support/pricing-fixtures';
import { MAX_PROMOTION_DAYS, PROMOTION_TITLE_MAX_LENGTH } from './constants';
import {
  editRefusal,
  preparePromotionEdit,
  publishRefusal,
  switchOffRefusal,
} from './promotion-edit';

const switchedOff = { active: false, switchedOffAt: at(-1), switchedOffBy: 'owner-a' };

describe('preparePromotionEdit', () => {
  it('keeps only what changes', () => {
    const result = preparePromotionEdit(promotion(), {
      title: ' Precio   especial ',
      endsAt: at(7 * DAY),
    });
    expect(result).toEqual({ ok: true, value: {} });
  });

  it('renames and extends', () => {
    const endsAt = at(10 * DAY);
    expect(preparePromotionEdit(promotion(), { title: 'Semana del gas', endsAt })).toEqual({
      ok: true,
      value: { title: 'Semana del gas', endsAt },
    });
  });

  it.each([
    ['an earlier end (customers saw it)', { endsAt: at(7 * DAY - 1) }, 'endsAt:invalid'],
    [
      'an end beyond 30 days from its start',
      { endsAt: at(MAX_PROMOTION_DAYS * DAY) },
      'endsAt:outOfRange',
    ],
    ['an empty title', { title: ' ' }, 'title:required'],
    ['a title too long', { title: 'T'.repeat(PROMOTION_TITLE_MAX_LENGTH + 1) }, 'title:tooLong'],
  ])('refuses %s', (_case, patch, expected) => {
    const result = preparePromotionEdit(promotion(), patch);
    expect(result.ok ? [] : result.issues.map((i) => `${i.field}:${i.code}`)).toEqual([expected]);
  });

  it('allows the longest end counted from its start', () => {
    const started = promotion({ startsAt: at(-DAY) });
    expect(preparePromotionEdit(started, { endsAt: at((MAX_PROMOTION_DAYS - 1) * DAY) }).ok).toBe(
      true,
    );
  });
});

describe('editRefusal', () => {
  it.each([
    [null, {}],
    [null, { active: false }],
    [null, { startsAt: at(DAY) }],
    ['ended', { endsAt: NOW }],
    ['switchedOff', switchedOff],
  ] as const)('answers %s for %o', (expected, change) => {
    expect(editRefusal(promotion(change), NOW)).toBe(expected);
  });
});

describe('publishRefusal', () => {
  it.each([
    [null, { active: false }],
    ['alreadyPublished', {}],
    ['alreadyPublished', { startsAt: at(DAY) }],
    ['ended', { active: false, endsAt: at(-1) }],
    ['switchedOff', switchedOff],
  ] as const)('answers %s for %o', (expected, change) => {
    expect(publishRefusal(promotion(change), NOW)).toBe(expected);
  });
});

describe('switchOffRefusal', () => {
  it.each([
    [null, {}],
    [null, { startsAt: at(DAY) }],
    [null, { totalUnits: 3, soldUnits: 3 }],
    ['notPublished', { active: false }],
    ['ended', { endsAt: at(-1) }],
    ['switchedOff', switchedOff],
  ] as const)('answers %s for %o', (expected, change) => {
    expect(switchOffRefusal(promotion(change), NOW)).toBe(expected);
  });
});
