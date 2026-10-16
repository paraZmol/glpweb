import { COMPLAINTS_BOOK_URL_MAX_LENGTH } from './constants';
import type { Check } from './field-checks';

/**
 * The link to the virtual complaints book (Libro de Reclamaciones) of a distributor, shown on its
 * public page (PLAN §11, 2026-10-15). Only `https://`, a host written in lowercase letters,
 * digits and hyphens with at least one dot, and then only the characters an address carries
 * without escaping (no spaces, quotes or angle brackets). Same pattern as
 * `isComplaintsBookUrl` in firebase/firestore.rules: change both together.
 */
const COMPLAINTS_BOOK_URL =
  /^https:\/\/[a-z0-9]([a-z0-9-]*[a-z0-9])?([.][a-z0-9]([a-z0-9-]*[a-z0-9])?)+(\/[A-Za-z0-9._~%!$&()*+,;=:@/?#-]*)?$/;

export function isComplaintsBookUrl(value: string): boolean {
  return value.length <= COMPLAINTS_BOOK_URL_MAX_LENGTH && COMPLAINTS_BOOK_URL.test(value);
}

const SCHEME_AND_HOST = /^https?:\/\/[^/?#]*/i;

/**
 * As a person pastes it: without spaces at the ends, and with the scheme and host in lowercase
 * (the path keeps its case: some servers tell it apart). Empty means "no link": null.
 */
export function normalizeComplaintsBookUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  return trimmed.replace(SCHEME_AND_HOST, (start) => start.toLowerCase());
}

/** `tooLong` past the cap, `invalid` for anything else that is not such a link. */
export function checkComplaintsBookUrl(value: string | null): Check {
  if (value === null) return null;
  if (value.length > COMPLAINTS_BOOK_URL_MAX_LENGTH) return 'tooLong';
  return isComplaintsBookUrl(value) ? null : 'invalid';
}
