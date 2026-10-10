import { describe, expect, it } from 'vitest';
import { contrastRatio, mixColors, normalizeHex, relativeLuminance } from './color';
import { checkBrandColor, faintThemeOf, MIN_BRAND_FILL_CONTRAST } from './brand-color-check';
import { DEFAULT_BRAND_COLOR } from '../tenancy/constants';
import { BRAND_THEME_BASES, deriveBrand, HORNILLA_BRAND_COLOR } from './derive-brand';

describe('colour maths', () => {
  it('measures the WCAG extremes', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#ff6a13', '#ff6a13')).toBe(1);
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 5);
  });

  it('measures the documented pair of the main button (ink on mandarin, 6.1)', () => {
    expect(contrastRatio('#14182b', '#ff6a13')).toBeCloseTo(6.1, 1);
  });

  it('mixes linearly in sRGB', () => {
    expect(mixColors('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(mixColors('#102030', '#ffffff', 0)).toBe('#102030');
    expect(mixColors('#102030', '#ffffff', 1)).toBe('#ffffff');
  });

  it.each([
    ['#ABC', '#aabbcc'],
    [' #FF6A13 ', '#ff6a13'],
    ['ff6a13', null],
    ['#ff6a1', null],
    ['#ff6a13aa', null],
    ['', null],
  ])('normalises %j to %j', (raw, expected) => {
    expect(normalizeHex(raw)).toBe(expected);
  });
});

describe('checkBrandColor', () => {
  it.each(['#1f2937', '#e11d48', '#f59e0b', '#ff6a13', '#0e8f6b', '#1757d6', '#000000'])(
    'accepts %s',
    (color) => {
      expect(checkBrandColor(color)).toEqual({ ok: true, color });
    },
  );

  it('accepts the colours the app itself starts from', () => {
    expect(checkBrandColor(DEFAULT_BRAND_COLOR).ok).toBe(true);
    expect(checkBrandColor(HORNILLA_BRAND_COLOR).ok).toBe(true);
  });

  it('normalises an accepted colour', () => {
    expect(checkBrandColor(' #E11D48 ')).toEqual({ ok: true, color: '#e11d48' });
  });

  it.each(['', 'naranja', '#12', '#zzzzzz'])('rejects %j as invalid', (value) => {
    expect(checkBrandColor(value)).toEqual({ ok: false, reason: 'invalid' });
  });

  it.each(['#ffffff', '#ffe600', '#fff7cc', '#e6f7ff', '#c8f7c5'])(
    'rejects %s because it disappears on the light background, and proposes a tone that passes',
    (color) => {
      const check = checkBrandColor(color);

      expect(check).toMatchObject({ ok: false, reason: 'tooFaint', theme: 'light' });
      const suggestion = check.ok || check.reason !== 'tooFaint' ? '' : check.suggestion;
      expect(checkBrandColor(suggestion)).toEqual({ ok: true, color: suggestion });
    },
  );

  it('proposes the closest tone, not just any that passes', () => {
    const check = checkBrandColor('#ffe600');

    const suggestion = check.ok || check.reason !== 'tooFaint' ? '' : check.suggestion;
    const oneStepBack = mixColors(suggestion, '#ffe600', 0.2);
    expect(faintThemeOf(oneStepBack)).toBe('light');
  });

  it('keeps the accepted fill at 2:1 or more from both backgrounds', () => {
    const accepted = ['#1f2937', '#e11d48', '#f59e0b', '#0e8f6b', '#000000', '#767676'];

    for (const color of accepted) {
      const derived = deriveBrand(color);
      expect(
        contrastRatio(derived.light.fill, BRAND_THEME_BASES.light.background),
      ).toBeGreaterThanOrEqual(MIN_BRAND_FILL_CONTRAST);
      expect(
        contrastRatio(derived.dark.fill, BRAND_THEME_BASES.dark.background),
      ).toBeGreaterThanOrEqual(MIN_BRAND_FILL_CONTRAST);
    }
  });
});
