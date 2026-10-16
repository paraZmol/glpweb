// PLAN 4.6, glp-domain §6.9: only its customer, only delivered, only once, 1 to 5.
import { describe, expect, it } from 'vitest';
import type { OrderStatus } from './status';
import { ORDER_STATUSES } from './status';
import { ratingRefusal } from './rating';

const CUSTOMER = { uid: 'customer-1', role: 'customer' } as const;
const delivered = { status: 'delivered' as const, customerUid: CUSTOMER.uid, rating: null };

describe('ratingRefusal', () => {
  it.each([[1], [3], [5]])('lets its customer rate a delivered order %i', (stars) => {
    expect(ratingRefusal(delivered, CUSTOMER, stars)).toBeNull();
  });

  it.each(ORDER_STATUSES.filter((s): s is Exclude<OrderStatus, 'delivered'> => s !== 'delivered'))(
    'refuses rating a %s order',
    (status) => {
      expect(ratingRefusal({ ...delivered, status }, CUSTOMER, 5)).toBe('notDelivered');
    },
  );

  it('refuses a second rating (§6.9)', () => {
    expect(ratingRefusal({ ...delivered, rating: 4 }, CUSTOMER, 5)).toBe('alreadyRated');
  });

  it.each([
    ['another customer', { uid: 'customer-2', role: 'customer' }],
    ['the driver', { uid: 'driver-1', role: 'driver' }],
    ['the owner', { uid: 'owner-1', role: 'owner' }],
    ['staff using the customer uid', { uid: CUSTOMER.uid, role: 'dispatcher' }],
  ] as const)('refuses %s', (_case, actor) => {
    expect(ratingRefusal(delivered, actor, 5)).toBe('notAllowed');
  });

  it('refuses a phone order without a customer account', () => {
    expect(ratingRefusal({ ...delivered, customerUid: null }, CUSTOMER, 5)).toBe('notAllowed');
  });

  it.each([[0], [6], [4.5], [-1], [Number.NaN]])('refuses %d stars', (stars) => {
    expect(ratingRefusal(delivered, CUSTOMER, stars)).toBe('invalidRating');
  });
});
