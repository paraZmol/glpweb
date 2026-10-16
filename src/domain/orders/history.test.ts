// PLAN 4.3: each change writes its timestamp and one log entry.
import { describe, expect, it } from 'vitest';
import { OrderTransitionError } from './errors';
import type { TransitionRequest } from './guards';
import { applyTransition, creationEntry } from './history';
import { cashPayment } from './payment';
import { AT, line } from './test-fixtures';

const DRIVER = { uid: 'driver-1', role: 'driver' } as const;
const OWNER = { uid: 'owner-1', role: 'owner' } as const;
const READY = { shiftApproved: true, hasOrderWithDriver: false, fullByProduct: { p00: 1 } };

const order = (status: TransitionRequest['order']['status'], driverUid: string | null = null) => ({
  status,
  customerUid: 'customer-1',
  driverUid,
  totalCents: 5200,
  lines: [line()],
});

describe('applyTransition', () => {
  it('assigns: status, driver, assignedAt and who did it', () => {
    const result = applyTransition(
      {
        order: order('pending'),
        to: 'assigned',
        actor: DRIVER,
        writable: true,
        assignee: { uid: DRIVER.uid, readiness: READY },
      },
      AT,
    );
    expect(result).toEqual({
      patch: { status: 'assigned', driverUid: DRIVER.uid, assignedAt: AT },
      entry: {
        from: 'pending',
        to: 'assigned',
        at: AT,
        byUid: DRIVER.uid,
        byRole: 'driver',
        driverUid: DRIVER.uid,
        previousDriverUid: null,
        reason: null,
        note: null,
      },
    });
  });

  it('takes the driver off: clears driver and assignedAt, the log keeps who had it', () => {
    const { patch, entry } = applyTransition(
      {
        order: order('assigned', DRIVER.uid),
        to: 'pending',
        actor: OWNER,
        writable: true,
        note: 'Moto en taller',
      },
      AT,
    );
    expect(patch).toEqual({ status: 'pending', driverUid: null, assignedAt: null });
    expect(entry).toMatchObject({
      from: 'assigned',
      to: 'pending',
      driverUid: null,
      previousDriverUid: DRIVER.uid,
      note: 'Moto en taller',
    });
  });

  it('reassigns in one write: new driver and assignedAt, the log keeps the previous driver', () => {
    const { patch, entry } = applyTransition(
      {
        order: order('assigned', DRIVER.uid),
        to: 'assigned',
        actor: OWNER,
        writable: true,
        assignee: { uid: 'driver-2', readiness: READY },
        note: 'El otro está más cerca',
      },
      AT,
    );
    expect(patch).toEqual({ status: 'assigned', driverUid: 'driver-2', assignedAt: AT });
    expect(entry).toMatchObject({
      from: 'assigned',
      to: 'assigned',
      driverUid: 'driver-2',
      previousDriverUid: DRIVER.uid,
      note: 'El otro está más cerca',
    });
  });

  it.each([
    ['onTheWay', 'assigned', 'onTheWayAt'],
    ['arrived', 'onTheWay', 'arrivedAt'],
  ] as const)('stamps %s with its own timestamp only', (to, from, field) => {
    const { patch } = applyTransition(
      { order: order(from, DRIVER.uid), to, actor: DRIVER, writable: true },
      AT,
    );
    expect(patch).toEqual({ status: to, [field]: AT });
  });

  it('delivers with the payment and deliveredAt', () => {
    const payment = cashPayment(5200, 10_000);
    const { patch } = applyTransition(
      {
        order: order('arrived', DRIVER.uid),
        to: 'delivered',
        actor: DRIVER,
        writable: true,
        payment,
      },
      AT,
    );
    expect(patch).toEqual({ status: 'delivered', deliveredAt: AT, payment });
  });

  it('cancels with its reason and note in the order and in the log, keeping the driver', () => {
    const cancellation = { reason: 'noEmptyCylinder', note: null } as const;
    const { patch, entry } = applyTransition(
      {
        order: order('arrived', DRIVER.uid),
        to: 'cancelled',
        actor: OWNER,
        writable: true,
        cancellation,
      },
      AT,
    );
    expect(patch).toEqual({ status: 'cancelled', cancelledAt: AT, cancellation });
    expect(entry).toMatchObject({
      reason: 'noEmptyCylinder',
      note: null,
      driverUid: DRIVER.uid,
      byRole: 'owner',
    });
  });

  it('ignores a note on a change that does not take one', () => {
    const { entry } = applyTransition(
      {
        order: order('assigned', DRIVER.uid),
        to: 'onTheWay',
        actor: DRIVER,
        writable: true,
        note: 'Hola',
      },
      AT,
    );
    expect(entry.note).toBeNull();
  });

  it('throws OrderTransitionError with the reason when the change is refused', () => {
    const run = () =>
      applyTransition(
        { order: order('delivered', DRIVER.uid), to: 'pending', actor: OWNER, writable: true },
        AT,
      );
    expect(run).toThrow(OrderTransitionError);
    expect(run).toThrow(/notATransition/);
  });
});

describe('creationEntry', () => {
  it('records the creation as coming from nowhere into pending', () => {
    expect(creationEntry({ createdBy: 'dispatcher-1', createdAt: AT }, 'dispatcher')).toEqual({
      from: null,
      to: 'pending',
      at: AT,
      byUid: 'dispatcher-1',
      byRole: 'dispatcher',
      driverUid: null,
      previousDriverUid: null,
      reason: null,
      note: null,
    });
  });
});
