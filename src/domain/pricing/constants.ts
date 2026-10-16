// Limits of the promotions (PLAN 3.5, §11 2026-10-16; docs/marketing/oferta-y-promociones.md
// D5, D6, D15), shared by the forms, the repositories and firebase/firestore.rules. The rules
// cannot import this file: when a value changes here, change it there too. The rules tests in
// firebase/tests read these constants, so a mismatch fails.

/**
 * Promotions alive at once per distributor (published, scheduled or saved unpublished). Each one
 * lives in a fixed slot (`o00` … `o19`), the only way the rules can cap them without a server; a
 * slot is reused once its promotion ended or was switched off.
 */
export const MAX_PROMOTIONS = 20;
/** Upper bound of every query of promotions; the rules reject a larger `limit`. */
export const PROMOTIONS_QUERY_LIMIT = MAX_PROMOTIONS;

export const PROMOTION_TITLE_MAX_LENGTH = 40;
export const PROMOTION_CONDITIONS_MAX_LENGTH = 140;

/** D6: the hardest percentage a form may offer. */
export const MAX_PERCENT_OFF = 30;

/** D6, H12: a promotion lasts at most 30 days; a permanent "offer" is a price. */
export const MAX_PROMOTION_DAYS = 30;
/** How far ahead a promotion may be scheduled (a proposal of PLAN §11, 2026-10-16). */
export const MAX_SCHEDULE_AHEAD_DAYS = 30;
/**
 * How far ahead the price lock of a product may reach: the latest end of a promotion scheduled
 * as far as allowed and lasting as long as allowed.
 */
export const MAX_PRICE_LOCK_DAYS = MAX_SCHEDULE_AHEAD_DAYS + MAX_PROMOTION_DAYS;

/** Units of one order that may take the promotion (the cap of cylinders per order is 20). */
export const MIN_UNITS_PER_ORDER = 1;
export const MAX_UNITS_PER_ORDER = 20;
/** The total cap, when there is one ("Quedan N", D15). */
export const MIN_TOTAL_UNITS = 1;
export const MAX_TOTAL_UNITS = 9_999;

/** "Lleva 2, paga 1" and "Lleva 3, paga 2": the only two the template offers (marketing P5). */
export const BUY_X_PAY_Y_OPTIONS = [
  { buyUnits: 2, payUnits: 1 },
  { buyUnits: 3, payUnits: 2 },
] as const;

/** Levels of the warning of what the owner stops charging (marketing §4, step 3). */
export const ATTENTION_ABOVE_PERCENT = 15;
export const RISK_ABOVE_PERCENT = 30;
