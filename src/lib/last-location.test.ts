import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  forgetLastLocation,
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

  it('keeps about one metre of precision, no more', () => {
    const stored = serializeLocation({
      point: { lat: -12.123456789, lng: -77.987654321 },
      source: 'manual',
    });

    expect(JSON.parse(stored)).toEqual({ lat: -12.12346, lng: -77.98765, source: 'manual' });
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
  ])('distrusts what it finds in storage: %j', (raw) => {
    expect(parseRememberedLocation(raw)).toBeNull();
  });

  it('works without storage: nothing is remembered and nothing fails', () => {
    vi.stubGlobal('localStorage', BLOCKED);

    expect(() => rememberLastLocation(HOME)).not.toThrow();
    expect(() => forgetLastLocation()).not.toThrow();
    expect(readLastLocation()).toBeNull();
  });
});
