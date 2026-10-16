// Shared data of the order tests: invented brands, prices and ids (the repo is public).
import type { Product } from '../catalog/product';
import type { OrderLine } from './lines';

export const AT = new Date('2026-10-16T15:00:00Z');

/** A 10 kg cylinder: refill S/ 52.00, full S/ 185.00. */
export function product(id: string, change: Partial<Product> = {}): Product {
  return {
    id,
    brand: 'Marca Uno',
    brandColor: null,
    weightKg: 10,
    name: 'Balón 10 kg',
    refillPriceCents: 5200,
    fullPriceCents: 18_500,
    currency: 'PEN',
    active: true,
    sortOrder: 0,
    createdAt: AT,
    updatedAt: AT,
    ...change,
  };
}

export const P10 = product('p00');
/** 45 kg, refill only: no full cylinder for sale. */
export const P45 = product('p01', {
  weightKg: 45,
  name: 'Balón 45 kg',
  refillPriceCents: 21_000,
  fullPriceCents: null,
});
export const RETIRED = product('p02', { active: false });
export const CATALOG = [P10, P45, RETIRED];

/** A frozen line at list price unless `change` says otherwise. */
export function line(change: Partial<OrderLine> = {}): OrderLine {
  return {
    productId: 'p00',
    saleMode: 'refill',
    quantity: 1,
    brand: 'Marca Uno',
    name: 'Balón 10 kg',
    weightKg: 10,
    listPriceCents: 5200,
    unitPriceCents: 5200,
    discountCents: 0,
    promotionId: null,
    ...change,
  };
}
