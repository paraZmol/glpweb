import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  forgetPendingProfile,
  PENDING_PROFILE_KEY,
  readPendingProfile,
  rememberPendingProfile,
} from './pending-profile';

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => void values.delete(key),
    setItem: (key, value) => void values.set(key, value),
  };
}

describe('pending profile (PLAN 2.11)', () => {
  let store: Storage;

  beforeEach(() => {
    store = memoryStorage();
    vi.stubGlobal('sessionStorage', store);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('hands back what the account typed when it registered', () => {
    rememberPendingProfile('u-1', { displayName: 'A. Persona', phone: '900000001' });

    expect(readPendingProfile('u-1')).toEqual({ displayName: 'A. Persona', phone: '900000001' });
  });

  it('reads a registration without a phone as no phone', () => {
    rememberPendingProfile('u-1', { displayName: 'A. Persona', phone: '' });

    expect(readPendingProfile('u-1')).toEqual({ displayName: 'A. Persona', phone: null });
  });

  it('never hands the details of one account to another', () => {
    rememberPendingProfile('u-1', { displayName: 'A. Persona', phone: '900000001' });

    expect(readPendingProfile('u-2')).toBeNull();
  });

  it('keeps it under one key of the app, in the session storage only', () => {
    const local = memoryStorage();
    vi.stubGlobal('localStorage', local);

    rememberPendingProfile('u-1', { displayName: 'A. Persona' });

    expect(store.getItem(PENDING_PROFILE_KEY)).not.toBeNull();
    expect(store.length).toBe(1);
    expect(local.length).toBe(0);
  });

  it('forgets it', () => {
    rememberPendingProfile('u-1', { displayName: 'A. Persona' });

    forgetPendingProfile();

    expect(readPendingProfile('u-1')).toBeNull();
    expect(store.length).toBe(0);
  });

  it.each([
    ['text that is not JSON', 'no-json'],
    ['a list', '[]'],
    ['a value of another shape', '{"uid":"u-1","displayName":7,"phone":""}'],
    ['null', 'null'],
  ])('reads %s as nothing', (_case, raw) => {
    store.setItem(PENDING_PROFILE_KEY, raw);

    expect(readPendingProfile('u-1')).toBeNull();
  });

  it('works without storage: nothing is kept and nothing fails', () => {
    vi.stubGlobal('sessionStorage', undefined);

    rememberPendingProfile('u-1', { displayName: 'A. Persona' });
    forgetPendingProfile();

    expect(readPendingProfile('u-1')).toBeNull();
  });

  it('survives a storage that refuses to write', () => {
    store.setItem = () => {
      throw new Error('QuotaExceededError');
    };

    expect(() => rememberPendingProfile('u-1', { displayName: 'A. Persona' })).not.toThrow();
    expect(readPendingProfile('u-1')).toBeNull();
  });
});
