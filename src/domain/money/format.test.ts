import { describe, expect, it } from 'vitest';
import { formatMoney } from './format';

describe('formatMoney', () => {
  it('formats soles with two decimals', () => {
    expect(formatMoney(3800)).toBe('S/ 38.00');
    expect(formatMoney(5)).toBe('S/ 0.05');
    expect(formatMoney(0)).toBe('S/ 0.00');
  });

  it('groups thousands and keeps the sign', () => {
    expect(formatMoney(123456)).toBe('S/ 1,234.56');
    expect(formatMoney(-250)).toBe('-S/ 2.50');
  });

  it('falls back to the currency code when it has no symbol', () => {
    expect(formatMoney(1000, 'USD')).toBe('USD 10.00');
  });

  it('rejects non-integer amounts', () => {
    expect(() => formatMoney(38.5)).toThrow(TypeError);
  });
});
