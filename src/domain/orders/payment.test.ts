// PLAN 5.4 (glp-domain §3): cash, Yape or Plin, always the frozen total.
import { describe, expect, it } from 'vitest';
import { MAX_CASH_OVERPAY_CENTS } from './constants';
import type { Payment } from './payment';
import { cashPayment, isPaymentMethod, paymentIssue, PAYMENT_METHODS } from './payment';

const TOTAL = 10_400;

describe('payment methods', () => {
  it('are cash, Yape and Plin, with no gateway and no failed state', () => {
    expect(PAYMENT_METHODS).toEqual(['cash', 'yape', 'plin']);
  });

  it.each([['card'], ['Yape'], [''], [undefined]])('rejects %j as a method', (value) => {
    expect(isPaymentMethod(value)).toBe(false);
  });
});

describe('cashPayment', () => {
  it('computes the change from what the customer handed over', () => {
    expect(cashPayment(TOTAL, 20_000)).toEqual({
      method: 'cash',
      amountCents: TOTAL,
      paidWithCents: 20_000,
      changeCents: 9600,
    });
  });
});

describe('paymentIssue', () => {
  it.each([
    ['exact cash', cashPayment(TOTAL, TOTAL)],
    ['cash with a S/ 200 bill over the total', cashPayment(TOTAL, TOTAL + MAX_CASH_OVERPAY_CENTS)],
    ['Yape', { method: 'yape', amountCents: TOTAL }],
    ['Plin', { method: 'plin', amountCents: TOTAL }],
  ] as const)('accepts %s', (_case, payment) => {
    expect(paymentIssue(payment, TOTAL)).toBeNull();
  });

  it.each([
    ['nothing', null, 'paymentRequired'],
    ['an unknown method', { method: 'card', amountCents: TOTAL }, 'paymentRequired'],
    ['less than the total', { method: 'plin', amountCents: TOTAL - 1 }, 'amountMismatch'],
    ['more than the total', { method: 'yape', amountCents: TOTAL + 1 }, 'amountMismatch'],
    ['a float amount', { method: 'yape', amountCents: TOTAL + 0.5 }, 'amountMismatch'],
    ['an amount as text', { method: 'yape', amountCents: '10400' }, 'amountMismatch'],
    ['cash short of the total', cashPayment(TOTAL, TOTAL - 1), 'invalidCash'],
    [
      'cash more than a S/ 200 bill over the total',
      cashPayment(TOTAL, TOTAL + MAX_CASH_OVERPAY_CENTS + 1),
      'invalidCash',
    ],
    [
      'cash with the wrong change',
      { method: 'cash', amountCents: TOTAL, paidWithCents: 20_000, changeCents: 9000 },
      'invalidCash',
    ],
    [
      'cash with a float handed over',
      { method: 'cash', amountCents: TOTAL, paidWithCents: 10_400.5, changeCents: 0.5 },
      'invalidCash',
    ],
    ['cash without what was handed over', { method: 'cash', amountCents: TOTAL }, 'invalidCash'],
    [
      'Yape carrying cash fields',
      { method: 'yape', amountCents: TOTAL, paidWithCents: TOTAL, changeCents: 0 },
      'invalidCash',
    ],
  ])('refuses %s', (_case, payment, expected) => {
    expect(paymentIssue(payment as Payment | null, TOTAL)).toBe(expected);
  });
});
