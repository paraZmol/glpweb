import { isValidPeruvianMobile, normalizePeruvianMobile } from './contact';

const PERU_COUNTRY_CODE = '51';
const PHONE_GROUP = /(\d{3})(?=\d)/g;

/** `900000011` → "900 000 011". Anything that is not a Peruvian mobile is shown as it came. */
export function formatPhone(phone: string): string {
  const digits = normalizePeruvianMobile(phone);
  return isValidPeruvianMobile(digits) ? digits.replace(PHONE_GROUP, '$1 ') : phone;
}

/**
 * `tel:` link for a stored phone, or null when the value is not a Peruvian mobile: a link is
 * never built from text that was not validated (tracking-pwa §4).
 */
export function telHref(phone: string): string | null {
  const digits = normalizePeruvianMobile(phone);
  return isValidPeruvianMobile(digits) ? `tel:+${PERU_COUNTRY_CODE}${digits}` : null;
}

/** `https://wa.me/51…` with an optional first message, encoded. Null for an unusable number. */
export function whatsappHref(phone: string, message = ''): string | null {
  const digits = normalizePeruvianMobile(phone);
  if (!isValidPeruvianMobile(digits)) return null;
  const base = `https://wa.me/${PERU_COUNTRY_CODE}${digits}`;
  return message === '' ? base : `${base}?text=${encodeURIComponent(message)}`;
}
