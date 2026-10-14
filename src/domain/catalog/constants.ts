// Limits of the catalogue (PLAN 3.1), shared by the forms, the repositories and
// firebase/firestore.rules. The rules cannot import this file: when a value changes here, change
// it there too. The rules tests in firebase/tests read these constants, so a mismatch fails.

export { BRAND_NAME_MAX_LENGTH, MAX_PRICE_CENTS } from '../tenancy/constants';

/**
 * Products per distributor. Each one lives in a fixed slot (`p00` … `p29`): it is the only way
 * the rules can cap a collection without a server (the same reason as the ten address slots).
 * A product is never deleted, only deactivated, so a slot is never reused.
 */
export const MAX_PRODUCTS = 30;
/** Upper bound of every catalogue query; the rules reject a larger `limit`. */
export const CATALOG_QUERY_LIMIT = MAX_PRODUCTS;

export const PRODUCT_NAME_MIN_LENGTH = 2;
export const PRODUCT_NAME_MAX_LENGTH = 60;

/** Weight of gas in the cylinder, in whole kilograms (3, 5, 10, 15, 45 kg in Peru). */
export const MIN_WEIGHT_KG = 1;
export const MAX_WEIGHT_KG = 100;

/** The smallest price the catalogue accepts: S/ 0.01. A free cylinder is a promotion. */
export const MIN_PRICE_CENTS = 1;

/** Position in the list the distributor chose; 0 comes first. */
export const MAX_SORT_ORDER = 999;
