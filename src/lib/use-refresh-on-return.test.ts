import { describe, expect, it } from 'vitest';
import {
  COSTLY_RETURN_REFRESH_GAP_MS,
  isReturnTooSoon,
  RETURN_REFRESH_GAP_MS,
} from './use-refresh-on-return';

describe('isReturnTooSoon (one load per return, never two for the same one)', () => {
  it('always lets the first return load', () => {
    expect(isReturnTooSoon(5_000, Number.NEGATIVE_INFINITY, RETURN_REFRESH_GAP_MS)).toBe(false);
  });

  it('counts the focus and visible events of one return as one', () => {
    expect(isReturnTooSoon(10_400, 10_000, RETURN_REFRESH_GAP_MS)).toBe(true);
    expect(isReturnTooSoon(11_000, 10_000, RETURN_REFRESH_GAP_MS)).toBe(false);
  });

  it('makes the costly lists wait a minute between loads', () => {
    expect(isReturnTooSoon(10_000 + 59_999, 10_000, COSTLY_RETURN_REFRESH_GAP_MS)).toBe(true);
    expect(isReturnTooSoon(10_000 + 60_000, 10_000, COSTLY_RETURN_REFRESH_GAP_MS)).toBe(false);
  });
});
