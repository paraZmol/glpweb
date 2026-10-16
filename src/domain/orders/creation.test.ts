// PLAN 4.2 and 4.4: who creates orders and with which limits.
import { describe, expect, it } from 'vitest';
import { MAX_PHONE_ORDER_CYLINDERS } from './constants';
import type { CreationRequest } from './creation';
import { creationRefusal, cylinderLimitFor, originFor, promisedMinutesFor } from './creation';
import { CATALOG } from './test-fixtures';

// About 1.1 km per 0.01 degree of latitude.
const PLANT = { lat: -12.05, lng: -77.04 };
const NEAR = { lat: -12.06, lng: -77.04 };
const FAR = { lat: -12.2, lng: -77.04 };

const request = (change: Partial<CreationRequest>): CreationRequest => ({
  role: 'customer',
  writable: true,
  acceptingOrders: true,
  maxCylindersPerOrder: 3,
  lines: [{ productId: 'p00', saleMode: 'refill', quantity: 1 }],
  products: CATALOG,
  hasAliveOrder: false,
  plant: PLANT,
  coverageRadiusKm: 5,
  destination: NEAR,
  ...change,
});

const cylinders = (quantity: number) => [
  { productId: 'p00', saleMode: 'refill' as const, quantity },
];

describe('originFor', () => {
  it.each([
    ['customer', 'app'],
    ['owner', 'phone'],
    ['dispatcher', 'phone'],
    ['driver', null],
  ] as const)('%s creates %s orders', (role, origin) => {
    expect(originFor(role)).toBe(origin);
  });
});

describe('cylinderLimitFor', () => {
  it('holds a customer to the distributor limit', () => {
    expect(cylinderLimitFor('app', 3)).toBe(3);
  });

  it('lets the office go over it on the phone, up to the sanity cap', () => {
    expect(cylinderLimitFor('phone', 3)).toBe(MAX_PHONE_ORDER_CYLINDERS);
  });
});

describe('creationRefusal', () => {
  it.each([
    ['a customer within coverage and the limit', request({})],
    ['a customer at exactly the limit', request({ lines: cylinders(3) })],
    [
      'the office over the customer limit (truck)',
      request({ role: 'dispatcher', lines: cylinders(40) }),
    ],
    ['the owner outside the coverage circle', request({ role: 'owner', destination: FAR })],
    [
      'the office while the listing is not public yet',
      request({ role: 'dispatcher', acceptingOrders: false }),
    ],
    [
      'the office for a customer that has another order alive',
      request({ role: 'owner', hasAliveOrder: true }),
    ],
  ])('accepts %s', (_case, input) => {
    expect(creationRefusal(input)).toBeNull();
  });

  it.each([
    ['a driver', request({ role: 'driver' }), 'notAllowed'],
    ['a read-only distributor', request({ writable: false }), 'readOnly'],
    [
      'the office of a read-only distributor',
      request({ role: 'owner', writable: false }),
      'readOnly',
    ],
    [
      'a customer when it is not taking orders',
      request({ acceptingOrders: false }),
      'notAcceptingOrders',
    ],
    ['a second alive order of the customer', request({ hasAliveOrder: true }), 'aliveOrderExists'],
    ['a customer outside coverage', request({ destination: FAR }), 'outOfCoverage'],
    ['a customer over the limit', request({ lines: cylinders(4) }), 'tooManyCylinders'],
    [
      'the office over the sanity cap',
      request({ role: 'dispatcher', lines: cylinders(MAX_PHONE_ORDER_CYLINDERS + 1) }),
      'tooManyCylinders',
    ],
    ['no lines', request({ lines: [] }), 'empty'],
    [
      'a product out of sale',
      request({ lines: [{ productId: 'p02', saleMode: 'refill', quantity: 1 }] }),
      'productOff',
    ],
  ])('refuses %s', (_case, input, expected) => {
    expect(creationRefusal(input)).toBe(expected);
  });
});

describe('promisedMinutesFor', () => {
  it('uses half a kilometre at least: 2 min of road plus 5 of dispatch', () => {
    expect(promisedMinutesFor(PLANT, PLANT)).toBe(7);
  });

  it('rounds the road time up', () => {
    // 0.01° of latitude ≈ 1.112 km → 3.34 min → 4, plus 5.
    expect(promisedMinutesFor(PLANT, NEAR)).toBe(9);
  });

  it('grows with distance at 20 km/h', () => {
    // 0.15° ≈ 16.68 km → 50.04 min → 51, plus 5.
    expect(promisedMinutesFor(PLANT, FAR)).toBe(56);
  });

  it('is always a whole number of minutes', () => {
    expect(Number.isInteger(promisedMinutesFor(PLANT, { lat: -12.0731, lng: -77.0123 }))).toBe(
      true,
    );
  });
});
