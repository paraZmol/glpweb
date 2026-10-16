import { describe, expect, it } from 'vitest';
import {
  ALIVE,
  FINAL,
  isAlive,
  isFinal,
  isOrderStatus,
  isWithDriver,
  ORDER_STATUSES,
  STATUS_TIMESTAMP,
  WITH_DRIVER,
} from './status';

describe('order statuses', () => {
  it('lists the six statuses of glp-domain in their order', () => {
    expect(ORDER_STATUSES).toEqual([
      'pending',
      'assigned',
      'onTheWay',
      'arrived',
      'delivered',
      'cancelled',
    ]);
  });

  it('counts arrived as with a driver (§6.7: a driver at the door is not free)', () => {
    expect(WITH_DRIVER).toEqual(['assigned', 'onTheWay', 'arrived']);
  });

  it('makes alive the pending order plus those with a driver', () => {
    expect(ALIVE).toEqual(['pending', 'assigned', 'onTheWay', 'arrived']);
  });

  it('splits every status into exactly one of alive and final', () => {
    expect([...ALIVE, ...FINAL].sort()).toEqual([...ORDER_STATUSES].sort());
  });

  it.each([
    ['pending', false, true, false],
    ['assigned', true, true, false],
    ['onTheWay', true, true, false],
    ['arrived', true, true, false],
    ['delivered', false, false, true],
    ['cancelled', false, false, true],
  ] as const)('%s: with driver %s, alive %s, final %s', (status, withDriver, alive, final) => {
    expect([isWithDriver(status), isAlive(status), isFinal(status)]).toEqual([
      withDriver,
      alive,
      final,
    ]);
  });

  it.each([['pending'], ['arrived'], ['cancelled']])('recognises %s', (value) => {
    expect(isOrderStatus(value)).toBe(true);
  });

  it.each([['Pending'], ['assigned '], ['enCola'], [''], [null], [3]])(
    'rejects %j as a status',
    (value) => {
      expect(isOrderStatus(value)).toBe(false);
    },
  );

  it('stamps every status a transition enters except pending, whose createdAt never changes', () => {
    expect(Object.keys(STATUS_TIMESTAMP).sort()).toEqual(
      ORDER_STATUSES.filter((s) => s !== 'pending').sort(),
    );
  });
});
