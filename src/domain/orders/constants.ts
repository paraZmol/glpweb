// Limits of an order (PLAN 4.2–4.6, §11 of 2026-10-16), shared by the forms, the repositories and
// firebase/firestore.rules. The rules cannot import this file: when a value changes here, change
// it there too. The rules tests in firebase/tests read these constants, so a mismatch fails.

export { DEFAULT_MAX_CYLINDERS_PER_ORDER, MAX_PRICE_CENTS } from '../tenancy/constants';

/** Lines of one order. A free unit of "lleva 2 paga 1" takes a line of its own. */
export const MAX_ORDER_LINES = 10;

/**
 * Cylinders of a phone order. The office may go over the distributor's `maxCylindersPerOrder`
 * (a business served by the truck); this is only the sanity cap against typos.
 */
export const MAX_PHONE_ORDER_CYLINDERS = 99;

/** Free text of a cancellation with the reason `other`, and of taking a driver off an order. */
export const ORDER_NOTE_MAX_LENGTH = 200;

/**
 * How much more than the total a customer may hand over in cash: the largest Peruvian bill,
 * S/ 200. Beyond that it is a typo in the amount, not a payment.
 */
export const MAX_CASH_OVERPAY_CENTS = 20_000;

export const RATING_MIN = 1;
export const RATING_MAX = 5;

/** Promised time (glp-domain §1): plant → address at urban speed, plus dispatch. */
export const URBAN_SPEED_KMH = 20;
export const DISPATCH_MINUTES = 5;
export const MIN_PROMISE_DISTANCE_KM = 0.5;
