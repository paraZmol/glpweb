import { describe, expect, it } from 'vitest';
import { formatMoney } from './format';
import { parseMoneyCents } from './parse';

describe('parseMoneyCents', () => {
  it.each([
    ['52', 5200],
    ['52.5', 5250],
    ['52.50', 5250],
    ['52,50', 5250],
    [' S/ 52.00 ', 5200],
    ['s/52', 5200],
    ['0.29', 29],
    ['0.01', 1],
    ['0', 0],
    ['1,250.00', 125000],
    ['1,250', 125000],
    ['1,25', 125],
  ])('reads %s as %i cents', (text, cents) => {
    expect(parseMoneyCents(text)).toBe(cents);
  });

  it.each(['', 'abc', '52.', '.5', '52.505', '-52', '+52', '52 soles', '5 2', '1,2,3', '١٢'])(
    'refuses %s',
    (text) => {
      expect(parseMoneyCents(text)).toBeNull();
    },
  );

  it('reads back what formatMoney writes', () => {
    expect(parseMoneyCents(formatMoney(123456))).toBe(123456);
  });
});
