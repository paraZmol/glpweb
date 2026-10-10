import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { textOf } from '../../../tests/support/render-static';
import type { ProductOffer, SaleMode } from '../../domain/catalog/sale-mode';
import { ProductCard } from './product-card';

// Sample data lives only here: the page has no catalogue to show until phase 3.
const PRODUCT: ProductOffer = {
  weightKg: 10,
  brandName: 'Marca Uno',
  brandColor: '#1757d6',
  refillPriceCents: 5200,
  fullPriceCents: 18500,
  currency: 'PEN',
};

const card = (product: ProductOffer, mode: SaleMode) =>
  renderToStaticMarkup(<ProductCard product={product} mode={mode} onModeChange={() => {}} />);

const checked = (html: string) =>
  (html.match(/<button\b[^>]*role="radio"[^>]*>/g) ?? []).map((tag) =>
    tag.includes('aria-checked="true"'),
  );

// docs/marketing/oferta-y-promociones.md §2.2: the card prepared for the catalogue (PLAN 2.5).
describe('product card', () => {
  it('draws the cylinder with the colour of its gas brand and names the product', () => {
    const html = card(PRODUCT, 'refill');

    expect(html).toContain('data-gas-brand=""');
    expect(html).toContain('aria-label="Balón de 10 kg"');
    expect(textOf(html)).toContain('Balón 10 kg');
    expect(textOf(html)).toContain('Marca Uno');
  });

  it('offers refill on the left and full cylinder on the right, each with its price', () => {
    const text = textOf(card(PRODUCT, 'refill'));

    expect(text).toContain('Recarga S/ 52.00');
    expect(text).toContain('Balón completo S/ 185.00');
    expect(text.indexOf('Recarga')).toBeLessThan(text.indexOf('Balón completo'));
  });

  it('marks refill as chosen and explains it', () => {
    const html = card(PRODUCT, 'refill');

    expect(checked(html)).toEqual([true, false]);
    expect(textOf(html)).toContain('Cambias tu balón vacío por uno lleno');
  });

  it('never shows "Balón completo" chosen without saying it is gas plus cylinder', () => {
    const html = card(PRODUCT, 'full');

    expect(checked(html)).toEqual([false, true]);
    expect(textOf(html)).toContain(
      'Gas + envase. No entregas vacío · No incluye regulador ni manguera',
    );
  });

  it('has no selector when the distributor does not sell the cylinder, and says so', () => {
    const html = card({ ...PRODUCT, fullPriceCents: null }, 'full');

    expect(html).not.toContain('role="radiogroup"');
    expect(textOf(html)).toContain('S/ 52.00');
    expect(textOf(html)).toContain(
      'Solo recarga. Esta distribuidora no vende envases de este balón.',
    );
  });
});
