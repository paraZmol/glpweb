import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BRAND_THEMES } from '../../domain/brand/derive-brand';
import { BrandTheme, GasBrandTheme } from './brand-theme';
import { GasCylinder } from './gas-cylinder';
import { Monogram } from './monogram';

const TONES = ['fill', 'on', 'soft', 'text'];

describe('BrandTheme (ui-system §6)', () => {
  // The three colours every branded screen is checked with: dark, vivid and light.
  it.each(['#1F2937', '#E11D48', '#F59E0B'])('writes the eight variables for %s', (color) => {
    const html = renderToStaticMarkup(<BrandTheme color={color}>contenido</BrandTheme>);

    expect(html).toContain('data-brand');
    for (const theme of BRAND_THEMES) {
      for (const tone of TONES) expect(html).toMatch(new RegExp(`--brand-${tone}-${theme}:#`));
    }
  });

  it.each([null, undefined, '', 'rojo', '#12'])(
    'leaves the Hornilla colour when the value is %j',
    (color) => {
      const html = renderToStaticMarkup(<BrandTheme color={color}>contenido</BrandTheme>);

      expect(html).not.toContain('data-brand');
      expect(html).toContain('contenido');
    },
  );

  it('uses its own attribute and prefix for the colour of a gas brand', () => {
    const html = renderToStaticMarkup(<GasBrandTheme color="#1757d6">balón</GasBrandTheme>);

    expect(html).toContain('data-gas-brand');
    expect(html).not.toContain('--brand-');
    for (const theme of BRAND_THEMES) {
      for (const tone of TONES) expect(html).toMatch(new RegExp(`--gas-${tone}-${theme}:#`));
    }
  });
});

describe('GasCylinder (ui-system §9.4)', () => {
  it.each([
    [10, '0 0 120 148'],
    [15, '0 0 120 178'],
    [45, '0 0 120 238'],
  ])('draws the %i kg silhouette on its own canvas', (weightKg, viewBox) => {
    const html = renderToStaticMarkup(<GasCylinder weightKg={weightKg} />);

    expect(html).toContain(`viewBox="${viewBox}"`);
    expect(html).toContain(`aria-label="Balón de ${weightKg} kg"`);
    expect(html).toContain(`>${weightKg} kg</text>`);
  });

  it('takes the colour of the gas brand, not a colour of its own', () => {
    const html = renderToStaticMarkup(<GasCylinder weightKg={10} />);

    expect(html).toContain('text-gas-brand');
    expect(html).not.toMatch(/#[0-9a-f]{6}\b/i);
  });

  it('labels another weight with its real number on the silhouette below it', () => {
    const html = renderToStaticMarkup(<GasCylinder weightKg={5} />);

    expect(html).toContain('viewBox="0 0 120 148"');
    expect(html).toContain('aria-label="Balón de 5 kg"');
  });

  it('is one flat colour, without label, as the symbol of an empty state', () => {
    const html = renderToStaticMarkup(<GasCylinder weightKg={10} tone="mono" />);

    expect(html).not.toContain('<text');
    expect(html).not.toContain('linearGradient');
    expect(html).not.toContain('text-gas-brand');
  });
});

describe('Monogram', () => {
  it('draws the two letters and hides them from screen readers', () => {
    const html = renderToStaticMarkup(<Monogram name="Gas Demo Norte" />);

    expect(html).toContain('>GD<');
    expect(html).toContain('aria-hidden="true"');
  });
});
