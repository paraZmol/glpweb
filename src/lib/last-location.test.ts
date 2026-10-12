import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  forgetLastLocation,
  LOCATION_MAX_AGE_DAYS,
  parseRememberedLocation,
  readLastLocation,
  rememberLastLocation,
  serializeLocation,
} from './last-location';

function fakeStorage(): Storage {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
    removeItem: (key) => void values.delete(key),
    clear: () => values.clear(),
    key: (index) => [...values.keys()][index] ?? null,
    get length() {
      return values.size;
    },
  };
}

const BLOCKED = {
  getItem: () => {
    throw new Error('SecurityError');
  },
  setItem: () => {
    throw new Error('QuotaExceededError');
  },
  removeItem: () => {
    throw new Error('SecurityError');
  },
} as unknown as Storage;

const HOME = { point: { lat: -12.05, lng: -77.04 }, source: 'device' } as const;
const NOW = Date.UTC(2026, 9, 11, 15);
const DAY_MS = 24 * 60 * 60 * 1000;
const OLD_FORMAT = JSON.stringify({ lat: -12.04567, lng: -77.04321, source: 'device' });
const stored = (patch: object = {}) =>
  JSON.stringify({ lat: -12.05, lng: -77.04, source: 'device', savedAt: NOW, ...patch });

afterEach(() => vi.unstubAllGlobals());

// PLAN 2.6: the last point searched from, remembered on the device only.
describe('remembered location', () => {
  it('comes back on the next visit, under a key of Hornilla', () => {
    const storage = fakeStorage();
    vi.stubGlobal('localStorage', storage);

    rememberLastLocation(HOME);

    expect(readLastLocation()).toEqual(HOME);
    expect(storage.key(0)).toBe('hornilla.lastLocation');
  });

  it('is forgotten on request', () => {
    vi.stubGlobal('localStorage', fakeStorage());
    rememberLastLocation(HOME);

    forgetLastLocation();

    expect(readLastLocation()).toBeNull();
  });

  // PLAN 2.11: three decimals (about a hundred metres) and the moment it was saved.
  it('keeps about a hundred metres of precision, no more, and the date', () => {
    const kept = serializeLocation(
      { point: { lat: -12.123456789, lng: -77.987654321 }, source: 'manual' },
      NOW,
    );

    expect(JSON.parse(kept)).toEqual({
      lat: -12.123,
      lng: -77.988,
      source: 'manual',
      savedAt: NOW,
    });
  });

  it('hands the point over rounded, as it was kept', () => {
    vi.stubGlobal('localStorage', fakeStorage());

    rememberLastLocation({ point: { lat: -12.04567, lng: -77.04321 }, source: 'device' }, NOW);

    expect(readLastLocation(NOW)?.point).toEqual({ lat: -12.046, lng: -77.043 });
  });

  // PLAN 2.11: a visitor without a session never signs out, so the point expires by itself.
  it.each([
    ['saved a moment ago', 0, true],
    [`on day ${LOCATION_MAX_AGE_DAYS}`, LOCATION_MAX_AGE_DAYS * DAY_MS, true],
    ['a second past the limit', LOCATION_MAX_AGE_DAYS * DAY_MS + 1000, false],
    ['a year old', 365 * DAY_MS, false],
    ['saved in the future (a clock set back)', -DAY_MS, false],
  ])('a point %s: kept is %s', (_case, ageMs, isKept) => {
    const found = parseRememberedLocation(stored({ savedAt: NOW - ageMs }), NOW);

    expect(found !== null).toBe(isKept);
  });

  it('removes from the device a point that expired, the first time it is read', () => {
    const storage = fakeStorage();
    vi.stubGlobal('localStorage', storage);
    rememberLastLocation(HOME, NOW);

    const later = NOW + (LOCATION_MAX_AGE_DAYS + 1) * DAY_MS;

    expect(readLastLocation(later)).toBeNull();
    expect(storage.length).toBe(0);
  });

  it('drops a point stored before the date existed (it had one metre of precision)', () => {
    const storage = fakeStorage();
    vi.stubGlobal('localStorage', storage);
    storage.setItem('hornilla.lastLocation', OLD_FORMAT);

    expect(readLastLocation(NOW)).toBeNull();
    expect(storage.length).toBe(0);
  });

  it.each([
    null,
    '',
    'no es json',
    '[]',
    '{"lat":"-12","lng":-77,"source":"device"}',
    '{"lat":-120,"lng":-77,"source":"device"}',
    '{"lat":-12,"lng":-77,"source":"gps"}',
    '{"lat":-12,"source":"device"}',
    stored({ savedAt: 'ayer' }),
    stored({ savedAt: null }),
    stored({ lat: -120 }),
  ])('distrusts what it finds in storage: %j', (raw) => {
    expect(parseRememberedLocation(raw, NOW)).toBeNull();
  });

  it('works without storage: nothing is remembered and nothing fails', () => {
    vi.stubGlobal('localStorage', BLOCKED);

    expect(() => rememberLastLocation(HOME)).not.toThrow();
    expect(() => forgetLastLocation()).not.toThrow();
    expect(readLastLocation()).toBeNull();
  });
});
