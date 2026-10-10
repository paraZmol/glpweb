import { describe, expect, it } from 'vitest';
import {
  describeDays,
  describeOpenStatus,
  formatTimeOfDay,
  localClockOf,
  openStatusAt,
} from './schedule';

const LIMA = 'America/Lima'; // UTC-5 all year
const MON_TO_SAT = { days: [1, 2, 3, 4, 5, 6], opensAt: '07:00', closesAt: '20:00' };
const EVERY_DAY = { days: [0, 1, 2, 3, 4, 5, 6], opensAt: '07:00', closesAt: '20:00' };

// 2026-10-10 is a Saturday.
const SATURDAY_NOON = new Date('2026-10-10T17:00:00Z');
const SATURDAY_6AM = new Date('2026-10-10T11:00:00Z');
const SATURDAY_9PM = new Date('2026-10-11T02:00:00Z');
const SUNDAY_NOON = new Date('2026-10-11T17:00:00Z');

describe('formatTimeOfDay', () => {
  it.each([
    ['07:00', '7:00 a. m.'],
    ['20:00', '8:00 p. m.'],
    ['00:05', '12:05 a. m.'],
    ['12:00', '12:00 p. m.'],
    ['15:30', '3:30 p. m.'],
  ])('shows %s as %s', (stored, shown) => {
    expect(formatTimeOfDay(stored)).toBe(shown);
  });
});

describe('localClockOf', () => {
  it('reads the day and the minute in the time zone of the distributor, not of the device', () => {
    expect(localClockOf(SATURDAY_9PM, LIMA)).toEqual({ day: 6, minutes: 21 * 60 });
    expect(localClockOf(SATURDAY_9PM, 'UTC')).toEqual({ day: 0, minutes: 2 * 60 });
  });
});

// PLAN 2.5 and 2.6: "si atiende ahora".
describe('openStatusAt', () => {
  it('is open inside the window of a listed day', () => {
    expect(openStatusAt(MON_TO_SAT, SATURDAY_NOON, LIMA)).toEqual({
      isOpen: true,
      closesAt: '20:00',
    });
  });

  it('is closed before opening and says it opens later today', () => {
    expect(openStatusAt(MON_TO_SAT, SATURDAY_6AM, LIMA)).toEqual({
      isOpen: false,
      opensAt: '07:00',
      daysUntil: 0,
      opensOn: 6,
    });
  });

  it('is closed at the closing minute and opens tomorrow when tomorrow is listed', () => {
    const atClosing = new Date('2026-10-11T01:00:00Z'); // Saturday 8:00 p. m. in Lima

    expect(openStatusAt(EVERY_DAY, atClosing, LIMA)).toMatchObject({ isOpen: false, daysUntil: 1 });
  });

  it('skips the days it does not attend', () => {
    expect(openStatusAt(MON_TO_SAT, SATURDAY_9PM, LIMA)).toMatchObject({
      isOpen: false,
      daysUntil: 2,
      opensOn: 1,
    });
    expect(openStatusAt(MON_TO_SAT, SUNDAY_NOON, LIMA)).toMatchObject({
      isOpen: false,
      daysUntil: 1,
      opensOn: 1,
    });
  });

  it('comes back to the same day next week when it attends only that day', () => {
    const onlySaturday = { days: [6], opensAt: '07:00', closesAt: '20:00' };

    expect(openStatusAt(onlySaturday, SATURDAY_9PM, LIMA)).toMatchObject({
      daysUntil: 7,
      opensOn: 6,
    });
  });
});

describe('describeOpenStatus', () => {
  it.each([
    [{ isOpen: true, closesAt: '20:00' } as const, 'Abierto · cierra a las 8:00 p. m.'],
    [
      { isOpen: false, opensAt: '07:00', daysUntil: 0, opensOn: 6 } as const,
      'Cerrado · abre a las 7:00 a. m.',
    ],
    [
      { isOpen: false, opensAt: '07:00', daysUntil: 1, opensOn: 0 } as const,
      'Cerrado · abre mañana a las 7:00 a. m.',
    ],
    [
      { isOpen: false, opensAt: '07:00', daysUntil: 2, opensOn: 1 } as const,
      'Cerrado · abre el lunes a las 7:00 a. m.',
    ],
  ])('%j reads %s', (status, sentence) => {
    expect(describeOpenStatus(status)).toBe(sentence);
  });
});

describe('describeDays', () => {
  it.each([
    [[0, 1, 2, 3, 4, 5, 6], 'Todos los días'],
    [[1, 2, 3, 4, 5, 6], 'Lunes a sábado'],
    [[6, 0, 5], 'Viernes a domingo'],
    [[0, 1, 2], 'Domingo a martes'],
    [[1, 3, 5], 'Lunes, miércoles y viernes'],
    [[6, 0], 'Sábado y domingo'],
    [[2], 'Martes'],
    [[], 'Sin días de atención'],
  ])('%j reads %s', (days, sentence) => {
    expect(describeDays(days)).toBe(sentence);
  });
});
