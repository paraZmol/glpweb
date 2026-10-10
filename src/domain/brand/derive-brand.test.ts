import { describe, expect, it } from 'vitest';
import { contrastRatio } from './color';
import {
  BRAND_THEME_BASES,
  BRAND_THEMES,
  brandCssVariables,
  deriveBrand,
  HORNILLA_BRAND_COLOR,
} from './derive-brand';

const INK = '#14182b';
const WHITE = '#ffffff';

// The table of ui-system §6: colour → fill and text-on-fill per theme, with its contrast.
const SPEC_TABLE = [
  ['ink', '#1F2937', ['#1f2937', WHITE, 14.7], ['#5b626c', WHITE, 6.2]],
  ['rocoto', '#E11D48', ['#e11d48', WHITE, 4.7], ['#e11d48', WHITE, 4.7]],
  ['amber', '#F59E0B', ['#f59e0b', INK, 8.2], ['#f59e0b', INK, 8.2]],
  ['mandarin', '#FF6A13', ['#ff6a13', INK, 6.1], ['#ff6a13', INK, 6.1]],
  ['green', '#0E8F6B', ['#1c9674', INK, 4.7], ['#1c9674', INK, 4.7]],
  ['blue', '#1757D6', ['#1757d6', WHITE, 6.2], ['#1757d6', WHITE, 6.2]],
] as const;

const EDGE_COLORS = ['#ffffff', '#000000', '#ffe600', '#7f7f7f', '#00ff00', '#0000ff'];

describe('deriveBrand', () => {
  it.each(SPEC_TABLE)('matches the spec table for %s in light', (_name, color, light) => {
    const { fill, on } = deriveBrand(color).light;

    expect([fill, on]).toEqual([light[0], light[1]]);
    expect(contrastRatio(fill, on)).toBeCloseTo(light[2], 1);
  });

  it.each(SPEC_TABLE)('matches the spec table for %s in dark', (_name, color, _light, dark) => {
    const { fill, on } = deriveBrand(color).dark;

    expect([fill, on]).toEqual([dark[0], dark[1]]);
    expect(contrastRatio(fill, on)).toBeCloseTo(dark[2], 1);
  });

  it.each([...SPEC_TABLE.map((row) => row[1]), ...EDGE_COLORS])(
    'keeps every text pair readable for %s',
    (color) => {
      const derived = deriveBrand(color);

      for (const theme of BRAND_THEMES) {
        const { fill, on, soft, text } = derived[theme];
        expect(contrastRatio(on, fill)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(text, soft)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(text, BRAND_THEME_BASES[theme].background)).toBeGreaterThanOrEqual(
          4.5,
        );
      }
    },
  );

  it('lifts a dark colour so it shows on the dark background', () => {
    const { fill } = deriveBrand('#1f2937').dark;

    expect(contrastRatio(fill, BRAND_THEME_BASES.dark.background)).toBeGreaterThanOrEqual(3);
  });

  it('accepts the short form and upper case', () => {
    expect(deriveBrand('#F00')).toEqual(deriveBrand('#ff0000'));
  });

  it.each(['', 'red', '#12345', '#gggggg', 'ff6a13'])(
    'falls back to the Hornilla colour for %j',
    (value) => {
      expect(deriveBrand(value)).toEqual(deriveBrand(HORNILLA_BRAND_COLOR));
    },
  );
});

describe('brandCssVariables', () => {
  const EXPECTED_NAMES = [
    '--brand-fill-light',
    '--brand-on-light',
    '--brand-soft-light',
    '--brand-text-light',
    '--brand-fill-dark',
    '--brand-on-dark',
    '--brand-soft-dark',
    '--brand-text-dark',
  ];

  it('writes the eight variables that [data-brand] reads', () => {
    const variables = brandCssVariables('#e11d48');

    expect(Object.keys(variables).sort()).toEqual([...EXPECTED_NAMES].sort());
    expect(variables['--brand-fill-light']).toBe('#e11d48');
    expect(Object.values(variables).every((value) => /^#[0-9a-f]{6}$/.test(value))).toBe(true);
  });

  it('uses the gas prefix for the colour of a gas brand', () => {
    const variables = brandCssVariables('#1757d6', 'gas');

    expect(Object.keys(variables).sort()).toEqual(
      EXPECTED_NAMES.map((name) => name.replace('--brand-', '--gas-')).sort(),
    );
  });
});
