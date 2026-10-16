// glp-domain §6.2: every pair of statuses, by every kind of actor. The expected table is written
// out from the skill (not read from transitions.ts); the cases are generated from it.
import { describe, expect, it } from 'vitest';
import type { TransitionRequest } from './guards';
import { transitionRefusal } from './guards';
import { cashPayment } from './payment';
import type { OrderStatus } from './status';
import { ORDER_STATUSES } from './status';
import { line } from './test-fixtures';
import type { OrderActor } from './transitions';
import { nextStatusesFor } from './transitions';

const ACTORS = {
  customer: { uid: 'customer-1', role: 'customer' },
  otherCustomer: { uid: 'customer-2', role: 'customer' },
  driver: { uid: 'driver-1', role: 'driver' },
  otherDriver: { uid: 'driver-2', role: 'driver' },
  owner: { uid: 'owner-1', role: 'owner' },
  dispatcher: { uid: 'dispatcher-1', role: 'dispatcher' },
} as const satisfies Record<string, OrderActor>;
type ActorKey = keyof typeof ACTORS;

/** glp-domain §1, written by hand. `driver` is the one carrying the order (`driver-1`). */
const ALLOWED: Record<string, readonly ActorKey[]> = {
  'pending>assigned': ['owner', 'dispatcher', 'driver', 'otherDriver'],
  'assigned>pending': ['owner', 'dispatcher'],
  'assigned>assigned': ['owner', 'dispatcher'],
  'assigned>onTheWay': ['driver'],
  'onTheWay>arrived': ['driver'],
  'arrived>delivered': ['driver'],
  'pending>cancelled': ['owner', 'dispatcher', 'customer'],
  'assigned>cancelled': ['owner', 'dispatcher'],
  'onTheWay>cancelled': ['owner', 'dispatcher'],
  'arrived>cancelled': ['owner', 'dispatcher'],
};

const TOTAL = 5200;
const READY = { shiftApproved: true, hasOrderWithDriver: false, fullByProduct: { p00: 3 } };
const HAS_DRIVER: readonly OrderStatus[] = ['assigned', 'onTheWay', 'arrived', 'delivered'];

/** A request carrying everything any transition could need, so only who and which pair decide. */
function request(from: OrderStatus, to: OrderStatus, actor: OrderActor): TransitionRequest {
  return {
    order: {
      status: from,
      customerUid: ACTORS.customer.uid,
      driverUid: HAS_DRIVER.includes(from) ? ACTORS.driver.uid : null,
      totalCents: TOTAL,
      lines: [line()],
    },
    to,
    actor,
    writable: true,
    assignee: { uid: actor.role === 'driver' ? actor.uid : 'driver-3', readiness: READY },
    cancellation: { reason: 'customerRequest', note: null },
    note: 'Se le malogró la moto',
    payment: cashPayment(TOTAL, 10_000),
  };
}

const CASES = ORDER_STATUSES.flatMap((from) =>
  ORDER_STATUSES.flatMap((to) =>
    (Object.keys(ACTORS) as ActorKey[]).map((actor) => {
      const pair = `${from}>${to}`;
      const allowed = ALLOWED[pair]?.includes(actor) ?? false;
      const refusal = allowed ? null : pair in ALLOWED ? 'notAllowed' : 'notATransition';
      return [pair, actor, refusal] as const;
    }),
  ),
);

describe('transition matrix (glp-domain §6.2)', () => {
  it('covers every pair of statuses by every actor', () => {
    expect(CASES).toHaveLength(ORDER_STATUSES.length ** 2 * Object.keys(ACTORS).length);
  });

  it.each(CASES)('%s by %s → %s', (pair, actor, expected) => {
    const [from, to] = pair.split('>') as [OrderStatus, OrderStatus];
    expect(transitionRefusal(request(from, to, ACTORS[actor]))).toBe(expected);
  });

  const CUSTOMER_CANCELS = (pair: string, actor: ActorKey) =>
    pair === 'pending>cancelled' && actor === 'customer';

  it.each(
    CASES.filter(([pair, actor, expected]) => expected === null && !CUSTOMER_CANCELS(pair, actor)),
  )('%s by %s is refused while the distributor is read-only (§6.10)', (pair, actor) => {
    const [from, to] = pair.split('>') as [OrderStatus, OrderStatus];
    expect(transitionRefusal({ ...request(from, to, ACTORS[actor]), writable: false })).toBe(
      'readOnly',
    );
  });
});

describe('read-only exception (user, 2026-10-16)', () => {
  it('lets the customer cancel its own pending order while the distributor is read-only', () => {
    const input = { ...request('pending', 'cancelled', ACTORS.customer), writable: false };
    expect(transitionRefusal(input)).toBeNull();
  });

  it('still refuses another customer cancelling it while read-only', () => {
    const input = { ...request('pending', 'cancelled', ACTORS.otherCustomer), writable: false };
    expect(transitionRefusal(input)).toBe('notAllowed');
  });

  it.each([['owner'], ['dispatcher']] as const)(
    'keeps %s cancelling blocked while read-only',
    (actor) => {
      const input = { ...request('pending', 'cancelled', ACTORS[actor]), writable: false };
      expect(transitionRefusal(input)).toBe('readOnly');
    },
  );
});

describe('nextStatusesFor', () => {
  const order = (status: OrderStatus) => request(status, status, ACTORS.owner).order;

  it.each([
    ['pending', 'customer', ['cancelled']],
    ['pending', 'otherCustomer', []],
    ['pending', 'driver', ['assigned']],
    ['pending', 'owner', ['assigned', 'cancelled']],
    ['assigned', 'driver', ['onTheWay']],
    ['assigned', 'otherDriver', []],
    ['assigned', 'dispatcher', ['pending', 'assigned', 'cancelled']],
    ['assigned', 'customer', []],
    ['onTheWay', 'driver', ['arrived']],
    ['arrived', 'driver', ['delivered']],
    ['arrived', 'owner', ['cancelled']],
    ['delivered', 'owner', []],
    ['cancelled', 'dispatcher', []],
  ] as const)('%s for %s offers %j', (status, actor, expected) => {
    expect(nextStatusesFor(order(status), ACTORS[actor])).toEqual(expected);
  });
});
