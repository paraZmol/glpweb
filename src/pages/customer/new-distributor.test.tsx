import { describe, expect, it } from 'vitest';
import { accountOf, PROFILE } from '../../../tests/support/account-fixtures';
import { count, renderStatic, tags, textOf } from '../../../tests/support/render-static';
import { BrandPreview } from '../../components/founding/brand-preview';
import { StepBrand } from '../../components/founding/step-brand';
import { StepLocation } from '../../components/founding/step-location';
import { StepReview } from '../../components/founding/step-review';
import { FocusShell } from '../../components/layout/focus-shell';
import { checkBrandColor } from '../../domain/brand/brand-color-check';
import { SUGGESTED_BRAND_COLORS } from '../../domain/brand/palette';
import { emptyFoundingForm, type FoundingForm } from '../../features/tenancy/founding-form';
import { ROUTES } from '../../lib/routes';
import { NewDistributorPage } from './new-distributor';

const reload = () => {};
const FORM: FoundingForm = {
  ...emptyFoundingForm({ displayName: 'Persona Demo', phone: '900000051' }),
  name: 'Gas Demo Centro',
  slug: 'gas-demo-centro',
  contactPhone: '900000061',
  latitude: '-8.1',
  longitude: '-79.03',
};
const step = { form: FORM, errors: {}, set: () => {} };
const names = (html: string) => tags(html, 'input').map((tag) => /name="([^"]+)"/.exec(tag)?.[1]);

function wizard(account = accountOf()): string {
  return renderStatic(<NewDistributorPage />, {
    path: ROUTES.newDistributor,
    shell: <FocusShell />,
    account,
  });
}

// PLAN 2.2: sign-up of a distributor.
describe('sign-up wizard of a distributor (PLAN 2.2)', () => {
  it('starts on the business step, with the progress said in words', () => {
    const html = wizard();

    expect(count(html, /<h1\b/)).toBe(1);
    expect(textOf(html)).toContain('Paso 1 de 4');
    expect(html).toContain('aria-valuetext="Paso 1 de 4: Negocio"');
    expect(names(html)).toEqual(['name', 'slug', 'contactPhone', 'whatsapp', 'ownerPhone']);
    expect(textOf(html)).toContain('Continuar');
    expect(textOf(html)).not.toContain('Atrás');
  });

  it('has a way out and no navigation to wander off', () => {
    const html = wizard();

    expect(textOf(html)).toContain('Salir');
    expect(html).not.toContain('aria-label="Principal"');
  });

  it('stops an account that already founded the maximum', () => {
    const profile = { ...PROFILE, ownedDistributorIds: ['a', 'b', 'c'] };
    const full = accountOf({
      profile: { status: 'ready', data: { profile, needsTermsAcceptance: false }, reload },
    });

    expect(textOf(wizard(full))).toContain('Ya registraste 3 distribuidoras.');
    expect(names(wizard(full))).toEqual([]);
  });
});

describe('location step', () => {
  const html = renderStatic(<StepLocation {...step} />);
  const text = textOf(html);

  it('says what the location is for before the button that asks for it', () => {
    const reason = text.indexOf('tu celular puede decirnos dónde queda');

    expect(reason).toBeGreaterThan(-1);
    expect(reason).toBeLessThan(text.indexOf('Usar mi ubicación'));
  });

  it('lets the plant be typed by hand, with help, and the radius be set', () => {
    expect(names(html)).toEqual(['latitude', 'longitude', 'addressLine']);
    expect(text).toContain('En el Perú los dos son negativos');
    expect(text).toContain('Radio de cobertura');
    expect(text).toContain('5 km');
  });

  it('leaves the place of the map as a gap that says so', () => {
    expect(text).toContain('Mapa en camino');
  });
});

describe('brand step', () => {
  it('offers a palette whose colours all pass the visibility check', () => {
    const html = renderStatic(<StepBrand {...step} />);

    expect(count(html, /role="radio"/)).toBe(SUGGESTED_BRAND_COLORS.length);
    expect(SUGGESTED_BRAND_COLORS.every(({ color }) => checkBrandColor(color).ok)).toBe(true);
  });

  it('explains a colour that is too faint and offers the closest tone that works', () => {
    const faint = { ...step, form: { ...FORM, brandColor: '#ffe600' } };
    const text = textOf(renderStatic(<StepBrand {...faint} />));

    expect(text).toContain('casi no se distingue del fondo blanco');
    expect(text).toContain('Usar este tono');
  });

  it('offers no other tone for a colour that is fine', () => {
    expect(textOf(renderStatic(<StepBrand {...step} />))).not.toContain('Usar este tono');
  });

  it('previews the monogram and a button in light and in dark, through BrandTheme', () => {
    const html = renderStatic(<BrandPreview color="#1f2937" name="Gas Demo Centro" />);

    expect(count(html, /<figure class="light"/)).toBe(1);
    expect(count(html, /<figure class="dark"/)).toBe(1);
    expect(count(html, /data-brand=""/)).toBe(2);
    expect(count(textOf(html), /GD/)).toBe(2);
    expect(textOf(html)).toContain('Hornilla ajusta un poco el tono');
  });
});

// PLAN 2.9: what the founder accepts, and what becomes public.
describe('review step', () => {
  const html = renderStatic(<StepReview {...step} />);
  const text = textOf(html).replaceAll(' (se abre en otra pestaña)', '');

  it('sums up what is about to be created', () => {
    expect(text).toContain('Gas Demo Centro');
    expect(text).toContain('/d/gas-demo-centro');
    expect(text).toContain('900 000 061');
    expect(text).toContain('-8.1000, -79.0300');
    expect(text).toContain('5 km desde la planta');
  });

  it('warns which data will be public', () => {
    expect(text).toContain(
      'El nombre, el teléfono, el WhatsApp, la dirección y la ubicación de la planta serán públicos.',
    );
  });

  it('asks for the two declarations, unticked, with the reviewed wording', () => {
    const boxes = tags(html, 'input');

    expect(names(html)).toEqual(['acceptTerms', 'declaresAuthority']);
    expect(boxes.some((box) => box.includes(' checked=""'))).toBe(false);
    expect(text).toContain(
      'Acepto los Términos y condiciones de Hornilla en nombre de esta distribuidora. Sé que los precios y las promociones que publique son responsabilidad de la distribuidora.',
    );
    expect(text).toContain(
      'Declaro que puedo representar a este negocio y que cuenta con las autorizaciones que la ley exige para comercializar GLP.',
    );
  });

  it('announces the free trial without a price', () => {
    expect(text).toContain('30 días de prueba gratis. Después eliges un plan.');
    expect(text).not.toMatch(/S\/ \d/);
  });
});
