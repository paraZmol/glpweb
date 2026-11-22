import { describe, expect, it } from 'vitest';
import { formatTime, relativeDayOf } from './format-date';

const LIMA = 'America/Lima';
// 21 nov 2026, 8:00 p. m. in Lima (UTC−5).
const NOW = new Date('2026-11-22T01:00:00Z');

describe('relativeDayOf', () => {
  it('says "hoy" for the same day where the business is', () => {
    expect(relativeDayOf(new Date('2026-11-21T23:29:00Z'), NOW, LIMA)).toBe('hoy');
  });

  it('counts the day by the business, not by UTC', () => {
    // 22 nov in UTC, still 21 nov in Lima; and 21 nov in UTC that was 20 nov in Lima.
    expect(relativeDayOf(new Date('2026-11-22T00:30:00Z'), NOW, LIMA)).toBe('hoy');
    expect(relativeDayOf(new Date('2026-11-21T04:00:00Z'), NOW, LIMA)).toBe('ayer');
  });

  it('says "ayer" for the day before and nothing for older days', () => {
    expect(relativeDayOf(new Date('2026-11-20T14:05:00Z'), NOW, LIMA)).toBe('ayer');
    expect(relativeDayOf(new Date('2026-11-20T04:59:00Z'), NOW, LIMA)).toBeNull();
  });
});

describe('formatTime', () => {
  it('writes the hour the way the screens do', () => {
    // Intl separates "p. m." with no-break spaces.
    expect(formatTime(new Date('2026-11-21T23:29:00Z'), LIMA)).toMatch(/^6:29\sp\.\sm\.$/);
  });
});
