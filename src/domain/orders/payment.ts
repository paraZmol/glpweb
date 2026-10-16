import { MAX_CASH_OVERPAY_CENTS } from './constants';

/**
 * How the customer paid at the door (glp-domain §3). Only recorded: there is no payment gateway
 * and no "payment failed" status. Yape and Plin go to the distributor's account; the driver
 * confirms them by looking at the customer's screen.
 */
export const PAYMENT_METHODS = ['cash', 'yape', 'plin'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export function isPaymentMethod(value: unknown): value is PaymentMethod {
  return (PAYMENT_METHODS as readonly unknown[]).includes(value);
}

export type Payment =
  | {
      method: 'cash';
      amountCents: number;
      /** What the customer handed over. */
      paidWithCents: number;
      changeCents: number;
    }
  | { method: 'yape' | 'plin'; amountCents: number };

export type PaymentIssue = 'paymentRequired' | 'amountMismatch' | 'invalidCash';

/** The payment of a cash sale handing over `paidWithCents`; the change is computed, never typed. */
export function cashPayment(totalCents: number, paidWithCents: number): Payment {
  return {
    method: 'cash',
    amountCents: totalCents,
    paidWithCents,
    changeCents: paidWithCents - totalCents,
  };
}

const isCents = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value);

function cashIssue(payment: Payment & { method: 'cash' }): PaymentIssue | null {
  const { amountCents, paidWithCents, changeCents } = payment;
  if (!isCents(paidWithCents) || !isCents(changeCents)) return 'invalidCash';
  if (paidWithCents < amountCents) return 'invalidCash';
  if (paidWithCents - amountCents > MAX_CASH_OVERPAY_CENTS) return 'invalidCash';
  return changeCents === paidWithCents - amountCents ? null : 'invalidCash';
}

/**
 * What is wrong with the payment that closes an order of `totalCents`, or null. A delivered
 * order without a payment is impossible (glp-domain §6.3), and it always charges the frozen total.
 */
export function paymentIssue(
  payment: Payment | null | undefined,
  totalCents: number,
): PaymentIssue | null {
  if (!payment || !isPaymentMethod(payment.method)) return 'paymentRequired';
  if (!isCents(payment.amountCents) || payment.amountCents !== totalCents) return 'amountMismatch';
  if (payment.method === 'cash') return cashIssue(payment);
  const extra = Object.keys(payment).filter((key) => key !== 'method' && key !== 'amountCents');
  return extra.length === 0 ? null : 'invalidCash';
}
