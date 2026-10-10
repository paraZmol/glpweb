// Limits shared by the forms, the repositories and firebase/firestore.rules.
// The rules cannot import this file: when a value changes here, change it there too. The rules
// tests in firebase/tests read these constants, so a mismatch fails the build.

export const TRIAL_DAYS = 30;
export const MAX_DISTRIBUTORS_PER_ACCOUNT = 3;

export const DISTRIBUTOR_NAME_MIN_LENGTH = 2;
export const DISTRIBUTOR_NAME_MAX_LENGTH = 60;
export const ADDRESS_LINE_MAX_LENGTH = 160;

export const DEFAULT_COVERAGE_RADIUS_KM = 5;
export const MIN_COVERAGE_RADIUS_KM = 1;
export const MAX_COVERAGE_RADIUS_KM = 50;

export const DEFAULT_MAX_CYLINDERS_PER_ORDER = 3;
export const MIN_CYLINDERS_PER_ORDER = 1;
export const MAX_CYLINDERS_PER_ORDER_LIMIT = 20;

export const MAX_BRANDS = 8;
export const BRAND_NAME_MAX_LENGTH = 30;
/** Sanity cap against typos when editing a price: S/ 999.00. */
export const MAX_PRICE_CENTS = 99_900;

export const DEFAULT_BRAND_COLOR = '#d9480f';
export const DEFAULT_CURRENCY = 'PEN';
export const DEFAULT_TIMEZONE = 'America/Lima';

export const DISPLAY_NAME_MAX_LENGTH = 80;
export const EMAIL_MAX_LENGTH = 254;

export const MAX_ADDRESSES_PER_USER = 10;
export const ADDRESS_LABEL_MAX_LENGTH = 40;
export const ADDRESS_REFERENCE_MAX_LENGTH = 160;

/** Upper bound of the public search query; the rules reject a larger `limit`. */
export const DISTRIBUTOR_SEARCH_LIMIT = 50;
export const MEMBERSHIPS_QUERY_LIMIT = 20;
export const MEMBERS_QUERY_LIMIT = 100;

const SUNDAY = 0;
const SATURDAY = 6;
export const WEEK_DAYS = [SUNDAY, 1, 2, 3, 4, 5, SATURDAY] as const;
export const DEFAULT_SCHEDULE = {
  days: [...WEEK_DAYS],
  opensAt: '07:00',
  closesAt: '20:00',
} as const;
