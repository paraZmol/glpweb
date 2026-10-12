import { describe, expect, it } from 'vitest';
import {
  isValidBrandColor,
  isValidPeruvianMobile,
  isValidTimeOfDay,
  normalizeBrandColor,
  normalizePeruvianMobile,
} from './contact';

describe('isValidPeruvianMobile', () => {
  it.each(['900000001', '900000099'])('accepts %s', (phone) => {
    expect(isValidPeruvianMobile(phone)).toBe(true);
  });

  it.each([
    '',
    '90000000',
    '9000000011',
    '800000001',
    '012345678',
    '90000000a',
    ' 900000001',
    '+51900000001',
    '900 000 001',
    '٩٠٠٠٠٠٠٠١',
  ])('rejects "%s"', (phone) => {
    expect(isValidPeruvianMobile(phone)).toBe(false);
  });
});

describe('normalizePeruvianMobile', () => {
  it.each([
    ['900 000 001', '900000001'],
    ['900-000-001', '900000001'],
    ['(900) 000.001', '900000001'],
    ['+51 900 000 001', '900000001'],
    ['0051900000001', '900000001'],
    ['51900000001', '900000001'],
    ['900000001', '900000001'],
    ['', ''],
  ])('%s → %s', (raw, expected) => {
    expect(normalizePeruvianMobile(raw)).toBe(expected);
  });

  it('does not strip a leading 51 that belongs to a short number', () => {
    expect(normalizePeruvianMobile('5190000')).toBe('5190000');
  });
});

describe('brand colour', () => {
  it.each(['#000000', '#ffffff', '#d9480f'])('accepts %s', (color) => {
    expect(isValidBrandColor(color)).toBe(true);
  });

  it.each(['', 'd9480f', '#D9480F', '#fff', '#d9480f80', '#gggggg', 'red', '#d9480f '])(
    'rejects "%s"',
    (color) => {
      expect(isValidBrandColor(color)).toBe(false);
    },
  );

  it('normalises case and spaces so a picker value becomes storable', () => {
    expect(normalizeBrandColor('  #D9480F ')).toBe('#d9480f');
    expect(isValidBrandColor(normalizeBrandColor('#ABCDEF'))).toBe(true);
  });
});

describe('isValidTimeOfDay', () => {
  it.each(['00:00', '07:00', '19:59', '23:59'])('accepts %s', (value) => {
    expect(isValidTimeOfDay(value)).toBe(true);
  });

  it.each(['', '7:00', '24:00', '12:60', '12:5', '12-30', '12:30:00'])('rejects "%s"', (value) => {
    expect(isValidTimeOfDay(value)).toBe(false);
  });
});
