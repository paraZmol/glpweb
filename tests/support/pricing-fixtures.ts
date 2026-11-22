import type { Product } from '../../src/domain/catalog/product';
import type { Promotion } from '../../src/domain/pricing/promotion';

// Invented data: the repository is public. Prices of the examples of
// docs/marketing/oferta-y-promociones.md (recarga 10 kg S/ 52.00, balón completo S/ 185.00).

/** Friday 16 October 2026, 10:00 a. m. in Lima. */
export const NOW = new Date('2026-10-16T15:00:00Z');
export const HOUR = 3_600_000;
export const DAY = 24 * HOUR;
export const at = (offsetMs: number) => new Date(NOW.getTime() + offsetMs);

export function product(change: Partial<Product> = {}): Product {
  return {
    id: 'p00',
    brand: 'Marca Uno',
    brandColor: '#1757d6',
    weightKg: 10,
    name: 'Balón 10 kg',
    refillPriceCents: 5200,
    fullPriceCents: 18500,
    currency: 'PEN',
    active: true,
    sortOrder: 0,
    promotedUntil: at(7 * DAY),
    createdAt: new Date('2026-10-01T12:00:00Z'),
    updatedAt: new Date('2026-10-01T12:00:00Z'),
    ...change,
  };
}

/** A catalogue: 10 kg (p00), 45 kg refill only (p01), 5 kg (p02); all locked for a week. */
export const CATALOG: Product[] = [
  product(),
  product({
    id: 'p01',
    weightKg: 45,
    name: 'Balón 45 kg',
    refillPriceCents: 19000,
    fullPriceCents: null,
    sortOrder: 1,
  }),
  product({
    id: 'p02',
    weightKg: 5,
    name: 'Balón 5 kg',
    refillPriceCents: 2800,
    fullPriceCents: 9000,
    sortOrder: 2,
  }),
];

/** P1 by default: "Precio especial", refill of p00 at S/ 48.00, live for a week, 2 per order. */
export function promotion(change: Partial<Promotion> = {}): Promotion {
  return {
    id: 'o00',
    title: 'Precio especial',
    deal: { type: 'fixedPrice', priceSource: 'own', priceCents: 4800 },
    productIds: ['p00'],
    saleMode: 'refill',
    startsAt: at(-HOUR),
    endsAt: at(7 * DAY),
    maxUnitsPerOrder: 2,
    totalUnits: null,
    conditions: '',
    active: true,
    soldUnits: 0,
    createdBy: 'owner-a',
    createdAt: at(-HOUR),
    updatedAt: at(-HOUR),
    switchedOffBy: null,
    switchedOffAt: null,
    ...change,
  };
}
