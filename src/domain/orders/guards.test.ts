// PLAN 4.3, 4.5, 4.6 and 5.4: what each transition needs besides the role.
import { describe, expect, it } from 'vitest';
import type { DriverReadiness, TransitionRequest } from './guards';
import { stockShortfall, transitionRefusal } from './guards';
import type { Payment } from './payment';
import { cashPayment } from './payment';
import type { Cancellation } from './reasons';
import { line } from './test-fixtures';

const CUSTOMER = { uid: 'customer-1', role: 'customer' } as const;
const DRIVER = { uid: 'driver-1', role: 'driver' } as const;
const DISPATCHER = { uid: 'dispatcher-1', role: 'dispatcher' } as const;
const TOTAL = 15_600;
const LINES = [
  line({ quantity: 2 }),
  line({ productId: 'p01', quantity: 1, unitPriceCents: 5200 }),
];
const READY: DriverReadiness = {
  shiftApproved: true,
  hasOrderWithDriver: false,
  fullByProduct: { p00: 2, p01: 1 },
};

const base = (change: Partial<TransitionRequest>): TransitionRequest => ({
  order: {
    status: 'pending',
    customerUid: CUSTOMER.uid,
    driverUid: null,
    totalCents: TOTAL,
    lines: LINES,
  },
  to: 'assigned',
  actor: DRIVER,
  writable: true,
  ...change,
});

const withStatus = (status: TransitionRequest['order']['status'], driverUid: string | null) => ({
  status,
  customerUid: CUSTOMER.uid,
  driverUid,
  totalCents: TOTAL,
  lines: LINES,
});

describe('accepting and assigning (PLAN 4.5)', () => {
  it('lets a ready driver accept the order for itself', () => {
    expect(transitionRefusal(base({ assignee: { uid: DRIVER.uid, readiness: READY } }))).toBeNull();
  });

  it('lets the office assign a ready driver', () => {
    const assignee = { uid: 'driver-7', readiness: READY };
    expect(transitionRefusal(base({ actor: DISPATCHER, assignee }))).toBeNull();
  });

  it.each([
    ['no driver named', undefined, 'driverRequired'],
    ['a driver accepting for another', { uid: 'driver-2', readiness: READY }, 'notAllowed'],
    [
      'a shift not approved (requested, paused or closed)',
      { uid: DRIVER.uid, readiness: { ...READY, shiftApproved: false } },
      'driverNotOnShift',
    ],
    [
      'a driver already carrying an order, arrived included (§6.7)',
      { uid: DRIVER.uid, readiness: { ...READY, hasOrderWithDriver: true } },
      'driverBusy',
    ],
    [
      'one cylinder short of the whole order',
      { uid: DRIVER.uid, readiness: { ...READY, fullByProduct: { p00: 1, p01: 1 } } },
      'notEnoughStock',
    ],
    [
      'no stock of one product at all',
      { uid: DRIVER.uid, readiness: { ...READY, fullByProduct: { p00: 5 } } },
      'notEnoughStock',
    ],
  ] as const)('refuses %s', (_case, assignee, expected) => {
    expect(transitionRefusal(base({ assignee }))).toBe(expected);
  });

  it('refuses the office assigning a driver that is not on shift', () => {
    const assignee = { uid: 'driver-7', readiness: { ...READY, shiftApproved: false } };
    expect(transitionRefusal(base({ actor: DISPATCHER, assignee }))).toBe('driverNotOnShift');
  });
});

describe('reassigning (assigned → assigned, user 2026-10-16)', () => {
  const reassign = (assignee: TransitionRequest['assignee'], note: string | undefined) =>
    base({
      order: withStatus('assigned', DRIVER.uid),
      to: 'assigned',
      actor: DISPATCHER,
      assignee,
      note,
    });
  const OTHER = { uid: 'driver-2', readiness: READY };

  it('lets the office hand it to another ready driver with a note', () => {
    expect(transitionRefusal(reassign(OTHER, 'Se le pinchó la llanta'))).toBeNull();
  });

  it.each([
    ['no driver named', undefined, 'Nota', 'driverRequired'],
    ['the same driver', { uid: DRIVER.uid, readiness: READY }, 'Nota', 'sameDriver'],
    ['no note', OTHER, undefined, 'noteRequired'],
    ['a blank note', OTHER, '  ', 'noteRequired'],
    ['a note of 201 characters', OTHER, 'a'.repeat(201), 'noteRequired'],
    [
      'a driver off shift',
      { uid: 'driver-2', readiness: { ...READY, shiftApproved: false } },
      'Nota',
      'driverNotOnShift',
    ],
    [
      'a busy driver',
      { uid: 'driver-2', readiness: { ...READY, hasOrderWithDriver: true } },
      'Nota',
      'driverBusy',
    ],
    [
      'a driver without stock',
      { uid: 'driver-2', readiness: { ...READY, fullByProduct: {} } },
      'Nota',
      'notEnoughStock',
    ],
  ] as const)('refuses %s', (_case, assignee, note, expected) => {
    expect(transitionRefusal(reassign(assignee, note))).toBe(expected);
  });
});

describe('stockShortfall', () => {
  it('adds refill and full units of the same product: each takes a full cylinder', () => {
    const lines = [line({ quantity: 2 }), line({ saleMode: 'full', quantity: 1 })];
    expect(stockShortfall(lines, { p00: 2 })).toEqual(['p00']);
    expect(stockShortfall(lines, { p00: 3 })).toEqual([]);
  });

  it('lists every product that falls short', () => {
    expect(stockShortfall(LINES, {})).toEqual(['p00', 'p01']);
  });
});

describe('taking the driver off (assigned → pending)', () => {
  const unassign = (note: string | undefined) =>
    base({ order: withStatus('assigned', DRIVER.uid), to: 'pending', actor: DISPATCHER, note });

  it('needs a note', () => {
    expect(transitionRefusal(unassign('Se quedó sin batería'))).toBeNull();
  });

  it.each([
    ['no note', undefined],
    ['an empty note', ''],
    ['only spaces', '   '],
    ['an invisible character', '​'],
    ['201 characters', 'a'.repeat(201)],
  ])('refuses %s', (_case, note) => {
    expect(transitionRefusal(unassign(note))).toBe('noteRequired');
  });

  it('accepts a note of exactly 200 characters, with accents and ñ', () => {
    expect(transitionRefusal(unassign(`Señal caída en Ñaña ${'á'.repeat(180)}`))).toBeNull();
  });
});

describe('cancelling', () => {
  const cancel = (
    actor: TransitionRequest['actor'],
    cancellation: Cancellation | undefined,
    status: 'pending' | 'arrived' = 'pending',
  ) =>
    base({
      order: withStatus(status, status === 'pending' ? null : DRIVER.uid),
      to: 'cancelled',
      actor,
      cancellation,
    });

  it('lets the customer cancel its pending order without typing a reason', () => {
    expect(
      transitionRefusal(cancel(CUSTOMER, { reason: 'customerRequest', note: null })),
    ).toBeNull();
  });

  it('lets the customer add a note', () => {
    const cancellation = { reason: 'customerRequest', note: 'Ya me trajeron' } as const;
    expect(transitionRefusal(cancel(CUSTOMER, cancellation))).toBeNull();
  });

  it('refuses the customer picking an office reason', () => {
    const cancellation = { reason: 'noEmptyCylinder', note: null } as const;
    expect(transitionRefusal(cancel(CUSTOMER, cancellation))).toBe('customerReasonOnly');
  });

  it.each([
    ['without a reason', undefined, 'reasonRequired'],
    ['with an unknown reason', { reason: 'bored', note: null }, 'reasonRequired'],
    ['with other and no note', { reason: 'other', note: null }, 'invalidNote'],
    ['with other and a blank note', { reason: 'other', note: ' ' }, 'invalidNote'],
    ['with a note too long', { reason: 'duplicate', note: 'x'.repeat(201) }, 'invalidNote'],
  ] as const)('refuses the office cancelling %s', (_case, cancellation, expected) => {
    expect(transitionRefusal(cancel(DISPATCHER, cancellation as Cancellation, 'arrived'))).toBe(
      expected,
    );
  });

  it.each([
    ['no empty cylinder', { reason: 'noEmptyCylinder', note: null }],
    ['other with its note', { reason: 'other', note: 'Dirección inexistente' }],
  ] as const)('lets the office cancel at the door: %s', (_case, cancellation) => {
    expect(transitionRefusal(cancel(DISPATCHER, cancellation, 'arrived'))).toBeNull();
  });
});

describe('delivering (arrived → delivered, §6.3)', () => {
  const deliver = (payment: Payment | undefined) =>
    base({ order: withStatus('arrived', DRIVER.uid), to: 'delivered', payment });

  it.each([
    ['cash with change', cashPayment(TOTAL, 20_000)],
    ['exact cash', cashPayment(TOTAL, TOTAL)],
    ['Yape', { method: 'yape', amountCents: TOTAL }],
    ['Plin', { method: 'plin', amountCents: TOTAL }],
  ] as const)('accepts %s', (_case, payment) => {
    expect(transitionRefusal(deliver(payment))).toBeNull();
  });

  it.each([
    ['no payment', undefined, 'paymentRequired'],
    [
      'an amount other than the total',
      { method: 'yape', amountCents: TOTAL - 1 },
      'amountMismatch',
    ],
    ['cash short of the total', cashPayment(TOTAL, TOTAL - 100), 'invalidCash'],
  ] as const)('refuses %s', (_case, payment, expected) => {
    expect(transitionRefusal(deliver(payment as Payment | undefined))).toBe(expected);
  });
});

describe('trips', () => {
  it.each([
    ['assigned', 'onTheWay'],
    ['onTheWay', 'arrived'],
  ] as const)('%s → %s needs nothing but its driver', (status, to) => {
    expect(transitionRefusal(base({ order: withStatus(status, DRIVER.uid), to }))).toBeNull();
  });
});
