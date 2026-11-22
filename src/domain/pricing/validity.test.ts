// PLAN §11, 2026-10-16: the validity of a promotion in the time of the distributor.
import { describe, expect, it } from 'vitest';
import { NOW } from '../../../tests/support/pricing-fixtures';
import {
  addDays,
  describeDay,
  describeValidity,
  instantAt,
  localDayOf,
  promotionWindow,
} from './validity';

const LIMA = 'America/Lima';
const LIMA_SETTINGS = { timeZone: LIMA, closesAt: '20:00' };
/** 8:00 p. m. in Lima is 01:00 UTC of the next day. */
const limaAt = (iso: string) => new Date(`${iso}-05:00`);

describe('local days', () => {
  it('reads the day in Lima, not in UTC', () => {
    expect(localDayOf(new Date('2026-10-17T03:00:00Z'), LIMA)).toEqual({
      year: 2026,
      month: 10,
      day: 16,
    });
  });

  it('finds the instant of a local time', () => {
    expect(instantAt({ year: 2026, month: 10, day: 18 }, '20:00', LIMA)).toEqual(
      limaAt('2026-10-18T20:00:00'),
    );
  });

  it('settles the days a zone changes its offset', () => {
    // Madrid moves from +2 to +1 on 25 October 2026.
    const zone = 'Europe/Madrid';
    expect(instantAt({ year: 2026, month: 10, day: 24 }, '20:00', zone)).toEqual(
      new Date('2026-10-24T18:00:00Z'),
    );
    expect(instantAt({ year: 2026, month: 10, day: 25 }, '20:00', zone)).toEqual(
      new Date('2026-10-25T19:00:00Z'),
    );
  });

  it('adds days across months and years', () => {
    expect(addDays({ year: 2026, month: 12, day: 30 }, 3)).toEqual({
      year: 2027,
      month: 1,
      day: 2,
    });
  });

  it('names a day in Spanish', () => {
    expect(describeDay(limaAt('2026-10-18T20:00:00'), LIMA)).toBe('domingo 18 de octubre');
  });
});

describe('promotionWindow', () => {
  // NOW is Friday 16 October 2026, 10:00 a. m. in Lima.
  it.each([
    ['today', { kind: 'today' }, '2026-10-16T20:00:00'],
    ['this weekend', { kind: 'weekend' }, '2026-10-18T20:00:00'],
    ['7 days, counting today', { kind: 'days', days: 7 }, '2026-10-22T20:00:00'],
    ['15 days', { kind: 'days', days: 15 }, '2026-10-30T20:00:00'],
    ['30 days', { kind: 'days', days: 30 }, '2026-11-14T20:00:00'],
  ] as const)('ends %s at closing time', (_case, preset, end) => {
    expect(promotionWindow(preset, NOW, LIMA_SETTINGS)).toEqual({
      startsAt: 'now',
      endsAt: limaAt(end),
    });
  });

  it('never lasts more than the days it names', () => {
    const late = { timeZone: LIMA, closesAt: '23:59' };
    const window = promotionWindow({ kind: 'days', days: 30 }, limaAt('2026-10-16T00:00:00'), late);
    expect(
      window && window.endsAt.getTime() - limaAt('2026-10-16T00:00:00').getTime(),
    ).toBeLessThanOrEqual(30 * 86_400_000);
  });

  it('answers null for "today" after closing time', () => {
    expect(
      promotionWindow({ kind: 'today' }, limaAt('2026-10-16T20:00:00'), LIMA_SETTINGS),
    ).toBeNull();
  });

  it('takes next Sunday on a Sunday after closing time', () => {
    const window = promotionWindow(
      { kind: 'weekend' },
      limaAt('2026-10-18T21:00:00'),
      LIMA_SETTINGS,
    );
    expect(window?.endsAt).toEqual(limaAt('2026-10-25T20:00:00'));
  });

  it('takes today on a Sunday before closing time', () => {
    const window = promotionWindow(
      { kind: 'weekend' },
      limaAt('2026-10-18T09:00:00'),
      LIMA_SETTINGS,
    );
    expect(window?.endsAt).toEqual(limaAt('2026-10-18T20:00:00'));
  });

  it('schedules "solo hoy, por horas" when the hours are ahead', () => {
    const preset = { kind: 'todayHours', from: '14:00', to: '17:00' } as const;
    expect(promotionWindow(preset, NOW, LIMA_SETTINGS)).toEqual({
      startsAt: limaAt('2026-10-16T14:00:00'),
      endsAt: limaAt('2026-10-16T17:00:00'),
    });
  });

  it('starts "solo hoy, por horas" now when the hours already began', () => {
    const preset = { kind: 'todayHours', from: '09:00', to: '17:00' } as const;
    expect(promotionWindow(preset, NOW, LIMA_SETTINGS)?.startsAt).toBe('now');
  });

  it('answers null for hours that passed', () => {
    const preset = { kind: 'todayHours', from: '07:00', to: '09:00' } as const;
    expect(promotionWindow(preset, NOW, LIMA_SETTINGS)).toBeNull();
  });
});

describe('describeValidity', () => {
  it.each([
    [
      'another day',
      NOW,
      limaAt('2026-10-18T20:00:00'),
      'Hasta el domingo 18 de octubre, 8:00 p. m.',
    ],
    ['today', NOW, limaAt('2026-10-16T20:00:00'), 'Solo hoy, hasta las 8:00 p. m.'],
    [
      'hours later today',
      limaAt('2026-10-16T14:00:00'),
      limaAt('2026-10-16T17:00:00'),
      'Solo hoy de 2:00 p. m. a 5:00 p. m.',
    ],
    [
      'hours that began',
      limaAt('2026-10-16T09:30:00'),
      limaAt('2026-10-16T17:00:00'),
      'Solo hoy, hasta las 5:00 p. m.',
    ],
  ])('says %s', (_case, startsAt, endsAt, expected) => {
    expect(describeValidity({ startsAt, endsAt }, NOW, LIMA)).toBe(expected);
  });

  it('counts the day in Lima: 8:00 p. m. there is already tomorrow in UTC', () => {
    expect(
      describeValidity({ startsAt: NOW, endsAt: limaAt('2026-10-16T20:00:00') }, NOW, LIMA),
    ).toBe('Solo hoy, hasta las 8:00 p. m.');
  });
});
