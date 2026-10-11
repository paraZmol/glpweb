import { describe, expect, it } from 'vitest';
import { SEED_DISTRIBUTORS } from '../../../tests/seed/data';
import { isValidRuc, normalizeRuc, rucCheckDigit } from './tax-id';

// Invented numbers: a prefix, zeros and the check digit that follows from them.
const VALID = [
  '20000000001',
  '10000000006',
  '20000000010',
  '15000000008',
  '17000000001',
  '20000000061',
];

describe('rucCheckDigit', () => {
  it.each([
    ['2000000000', 1],
    ['2000000001', 0],
    ['1000000000', 6],
    // Complement 11 maps to 1, complement 10 to 0.
    ['2000000006', 1],
    ['2000000015', 0],
  ])('gives %s the digit %i', (firstTen, digit) => {
    expect(rucCheckDigit(firstTen)).toBe(digit);
  });
});

describe('isValidRuc', () => {
  it.each(VALID)('accepts %s', (ruc) => {
    expect(isValidRuc(ruc)).toBe(true);
  });

  it.each([
    ['an empty text', ''],
    ['ten digits', '2000000000'],
    ['twelve digits', '200000000010'],
    ['a wrong check digit', '20000000002'],
    ['an unknown kind of taxpayer', '30000000007'],
    ['letters', '2000000000A'],
    ['spaces inside', '20 00000000 1'],
    ['a sign', '-2000000001'],
    ['full-width digits', '２００００００００１'],
  ])('refuses %s', (_case, ruc) => {
    expect(isValidRuc(ruc)).toBe(false);
  });

  it('refuses every single-digit typo of a valid number', () => {
    const valid = '20000000001';
    for (let index = 2; index < valid.length; index += 1) {
      const wrong = (Number(valid[index]) + 1) % 10;
      const typo = `${valid.slice(0, index)}${wrong}${valid.slice(index + 1)}`;
      expect(isValidRuc(typo), typo).toBe(false);
    }
  });

  it('accepts the invented numbers of the seed', () => {
    for (const distributor of Object.values(SEED_DISTRIBUTORS)) {
      expect(isValidRuc(distributor.taxId), distributor.id).toBe(true);
    }
  });
});

describe('normalizeRuc', () => {
  it('keeps only the digits', () => {
    expect(normalizeRuc(' 20-00000000-1 ')).toBe('20000000001');
    expect(normalizeRuc('RUC 20000000001')).toBe('20000000001');
  });
});
