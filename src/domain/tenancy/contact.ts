/** Peruvian mobile: nine digits starting with 9. Stored without prefix or separators. */
const PERUVIAN_MOBILE_PATTERN = /^9\d{8}$/;
const PHONE_SEPARATORS = /[\s().-]/g;
const COUNTRY_PREFIX = /^(?:\+51|0051|51(?=9\d{8}$))/;
const BRAND_COLOR_PATTERN = /^#[0-9a-f]{6}$/;

/** Removes separators and the +51 country prefix. Does not validate. */
export function normalizePeruvianMobile(raw: string): string {
  return raw.replace(PHONE_SEPARATORS, '').replace(COUNTRY_PREFIX, '');
}

export function isValidPeruvianMobile(phone: string): boolean {
  return PERUVIAN_MOBILE_PATTERN.test(phone);
}

/** Lowercases and trims; `#RRGGBB` only (no short form, no alpha). Does not validate. */
export function normalizeBrandColor(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Brand colours are stored as lowercase `#rrggbb`, the only shape the rules accept. */
export function isValidBrandColor(color: string): boolean {
  return BRAND_COLOR_PATTERN.test(color);
}

const TIME_OF_DAY_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

/** 24-hour `HH:MM`, as stored in a distributor schedule. */
export function isValidTimeOfDay(value: string): boolean {
  return TIME_OF_DAY_PATTERN.test(value);
}
