import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { textOf } from '../../../tests/support/render-static';
import type { Product } from '../../domain/catalog/product';
import { PermissionDeniedError } from '../../domain/tenancy/errors';
import type { AsyncResource } from '../../lib/use-async-resource';
import { ProductsBody } from './distributor-products';

const product = (id: string, patch: Partial<Product> = {}): Product => ({
  id,
  brand: 'Marca Uno',
  brandColor: '#1757d6',
  weightKg: 10,
  name: 'Balón 10 kg',
  refillPriceCents: 4800,
  fullPriceCents: null,
  currency: 'PEN',
  active: true,
  sortOrder: 0,
  createdAt: new Date('2026-10-14T15:00:00Z'),
  updatedAt: new Date('2026-10-14T15:00:00Z'),
  ...patch,
});

const body = (catalog: AsyncResource<Product[]>) =>
  textOf(renderToStaticMarkup(<ProductsBody catalog={catalog} onRetry={() => {}} />));

// PLAN 3.1 and docs/marketing/oferta-y-promociones.md §2.2: the prices of /d/{slug}.
describe('products of the public page', () => {
  it('shows each product with its refill price, and the full cylinder only where it is sold', () => {
    const text = body({
      status: 'ready',
      data: [
        product('p00', { fullPriceCents: 17500 }),
        product('p01', { name: 'Balón 5 kg', weightKg: 5, refillPriceCents: 3800 }),
      ],
    });

    expect(text).toContain('Recarga S/ 48.00');
    expect(text).toContain('Balón completo S/ 175.00');
    expect(text).toContain('S/ 38.00');
    expect(text).toContain('Solo recarga. Esta distribuidora no vende envases de este balón.');
    expect(text.indexOf('Balón 10 kg')).toBeLessThan(text.indexOf('Balón 5 kg'));
  });

  it('says how the refill works, and points to the full cylinder only if it is sold', () => {
    const both = body({ status: 'ready', data: [product('p00', { fullPriceCents: 17500 })] });
    const refillOnly = body({ status: 'ready', data: [product('p00')] });

    expect(both).toContain(
      'Precios de recarga: cambias tu balón vacío por uno lleno. ¿No tienes balón? Elige “Balón completo”.',
    );
    expect(refillOnly).toContain('Precios de recarga: cambias tu balón vacío por uno lleno.');
    expect(refillOnly).not.toContain('¿No tienes balón?');
  });

  it('sends to the phone when there are no prices yet', () => {
    const text = body({ status: 'ready', data: [] });

    expect(text).toContain('Esta distribuidora todavía no publicó sus precios.');
    expect(text).toContain('Llámala o escríbele.');
  });

  it('never offers to order: that is phase 4', () => {
    expect(body({ status: 'ready', data: [product('p00')] })).not.toMatch(/Pedir|Agregar/);
  });

  it('holds the place while loading and offers a retry when it fails', () => {
    expect(body({ status: 'loading' })).toContain('Cargando los precios');
    expect(body({ status: 'error', error: new PermissionDeniedError() })).toContain('Reintentar');
  });
});
