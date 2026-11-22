import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { tags, textOf } from '../../../tests/support/render-static';
import type { Product } from '../../domain/catalog/product';
import {
  CatalogEmpty,
  CatalogList,
  type CatalogControls,
  CatalogListSkeleton,
} from './catalog-list';

const product = (id: string, patch: Partial<Product> = {}): Product => ({
  id,
  brand: 'Marca Uno',
  brandColor: '#1757d6',
  weightKg: 10,
  name: 'Balón 10 kg',
  refillPriceCents: 4800,
  fullPriceCents: 17500,
  currency: 'PEN',
  active: true,
  sortOrder: Number(id.slice(1)),
  createdAt: new Date('2026-10-14T15:00:00Z'),
  updatedAt: new Date('2026-10-14T15:00:00Z'),
  ...patch,
});

const CATALOG = [
  product('p00'),
  product('p01', { brand: 'Marca Dos', weightKg: 5, name: 'Balón 5 kg', fullPriceCents: null }),
  product('p02', { brand: 'Marca Dos', weightKg: 15, name: 'Balón 15 kg', active: false }),
];

const CONTROLS: CatalogControls = {
  busyOf: () => null,
  isLocked: false,
  onEdit: () => {},
  onMove: () => {},
  onToggleSale: () => {},
};

const buttons = (html: string) => tags(html, 'button');
const isDisabled = (tag: string) => /\sdisabled=""/.test(tag);
const buttonLabelled = (html: string, label: string) =>
  buttons(html).find((tag) => tag.includes(`aria-label="${label}"`)) ?? '';

// PLAN 3.1: the catalogue of the office.
describe('catalogue list', () => {
  it('shows both prices, "Solo recarga" without a full cylinder, and what is off sale', () => {
    const text = textOf(renderToStaticMarkup(<CatalogList products={CATALOG} />));

    expect(text).toContain('Balón 10 kg · Marca Uno');
    expect(text).toContain('Recarga S/ 48.00');
    expect(text).toContain('Balón completo · gas + envase S/ 175.00');
    expect(text).toContain('Solo recarga');
    expect(text).toContain('Fuera de venta');
    expect(text.match(/A la venta/g)).toHaveLength(2);
  });

  it('keeps the order it is given', () => {
    const text = textOf(renderToStaticMarkup(<CatalogList products={CATALOG} />));

    expect(text.indexOf('Balón 10 kg')).toBeLessThan(text.indexOf('Balón 5 kg'));
    expect(text.indexOf('Balón 5 kg')).toBeLessThan(text.indexOf('Balón 15 kg'));
  });

  it('has not a single button for whoever only reads it', () => {
    expect(buttons(renderToStaticMarkup(<CatalogList products={CATALOG} />))).toEqual([]);
  });

  it('gives the owner named controls, without moving past either end', () => {
    const html = renderToStaticMarkup(<CatalogList products={CATALOG} controls={CONTROLS} />);
    const text = textOf(html);

    expect(isDisabled(buttonLabelled(html, 'Subir Balón 10 kg · Marca Uno'))).toBe(true);
    expect(isDisabled(buttonLabelled(html, 'Bajar Balón 10 kg · Marca Uno'))).toBe(false);
    expect(isDisabled(buttonLabelled(html, 'Bajar Balón 15 kg · Marca Dos'))).toBe(true);
    expect(text).toContain('Editar Balón 5 kg · Marca Dos');
    expect(text).toContain('Quitar de la venta Balón 10 kg · Marca Uno');
    expect(text).toContain('Poner a la venta Balón 15 kg · Marca Dos');
  });

  it('locks every control while something runs or there is no connection', () => {
    const html = renderToStaticMarkup(
      <CatalogList products={CATALOG} controls={{ ...CONTROLS, isLocked: true }} />,
    );

    expect(buttons(html).every(isDisabled)).toBe(true);
  });

  it('has a loading shape and an empty state', () => {
    expect(textOf(renderToStaticMarkup(<CatalogListSkeleton />))).toBe('Cargando el catálogo');
    expect(
      textOf(
        renderToStaticMarkup(<CatalogEmpty title="Todavía no hay productos." description="" />),
      ),
    ).toContain('Todavía no hay productos.');
  });
});
