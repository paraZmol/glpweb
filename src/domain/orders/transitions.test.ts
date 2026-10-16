import { describe, expect, it } from 'vitest';
import { FINAL } from './status';
import { findTransition, holdsRelation, ORDER_ACTOR_ROLES, ORDER_TRANSITIONS } from './transitions';

describe('transition table', () => {
  it('names each pair once', () => {
    const pairs = ORDER_TRANSITIONS.map((t) => `${t.from}>${t.to}`);
    expect(new Set(pairs).size).toBe(pairs.length);
  });

  it('never leaves a final status', () => {
    expect(ORDER_TRANSITIONS.filter((t) => (FINAL as readonly string[]).includes(t.from))).toEqual(
      [],
    );
  });

  it('never keeps the same status', () => {
    expect(ORDER_TRANSITIONS.filter((t) => t.from === t.to)).toEqual([]);
  });

  it('lets the driver cancel nothing (it reports the problem; the office cancels)', () => {
    expect(ORDER_TRANSITIONS.filter((t) => t.to === 'cancelled' && t.by.driver)).toEqual([]);
  });

  it('lets the customer act only to cancel its pending order', () => {
    expect(ORDER_TRANSITIONS.filter((t) => t.by.customer).map((t) => `${t.from}>${t.to}`)).toEqual([
      'pending>cancelled',
    ]);
  });

  it('has the customer and every staff role as actors, and nobody else', () => {
    expect(ORDER_ACTOR_ROLES).toEqual(['customer', 'owner', 'dispatcher', 'driver']);
  });

  it('finds nothing for a pair outside the table', () => {
    expect(findTransition('delivered', 'pending')).toBeNull();
  });
});

describe('holdsRelation', () => {
  const order = { customerUid: 'customer-1', driverUid: 'driver-1' };

  it.each([
    ['anyOrder', 'owner-1', true],
    ['takesIt', 'driver-9', true],
    ['ownOrder', 'customer-1', true],
    ['ownOrder', 'customer-2', false],
    ['ownDelivery', 'driver-1', true],
    ['ownDelivery', 'driver-2', false],
  ] as const)('%s for %s → %s', (relation, uid, expected) => {
    expect(holdsRelation(relation, { uid, role: 'driver' }, order)).toBe(expected);
  });

  it('never matches a missing customer or driver', () => {
    const empty = { customerUid: null, driverUid: null };
    expect(holdsRelation('ownOrder', { uid: '', role: 'customer' }, empty)).toBe(false);
    expect(holdsRelation('ownDelivery', { uid: '', role: 'driver' }, empty)).toBe(false);
  });
});
