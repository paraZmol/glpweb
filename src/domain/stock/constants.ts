// Limits of the plant stock (PLAN 3.4), shared by the forms, the repositories and
// firebase/firestore.rules. The rules cannot import this file: when a value changes here, change
// it there too. The rules tests in firebase/tests read these constants, so a mismatch fails.

/** Full or empty cylinders of one product at the plant: a sanity cap against slips of a finger. */
export const MAX_STOCK_UNITS = 99_999;

/** The largest change one adjustment makes to full or to empty cylinders, either way. */
export const MAX_ADJUSTMENT_UNITS = 9_999;

export const ADJUSTMENT_NOTE_MAX_LENGTH = 200;

/** The stock documents are one per product: at most as many as product slots. */
export const PLANT_STOCK_QUERY_LIMIT = 30;

/** A page of the history of movements; the rules refuse a `limit` above `MOVEMENTS_QUERY_MAX`. */
export const MOVEMENTS_QUERY_LIMIT = 20;
export const MOVEMENTS_QUERY_MAX = 50;
