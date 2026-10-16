import { isValidPeruvianMobile } from './contact';
import type { SlugIssue } from './slug';

export type FieldIssueCode =
  | 'required'
  | 'tooLong'
  | 'tooShort'
  | 'outOfRange'
  | 'invalid'
  /** A brand colour that cannot be told apart from the page background. */
  | 'tooFaint'
  /** A value that must be greater than another field of the same form (full vs refill price). */
  | 'notAbove'
  /** A value that must be below another one (a promoted price under the list price). */
  | 'notBelow'
  /** A value that must be a multiple of another one (units of "lleva X, paga Y"). */
  | 'notMultiple'
  /** Text with a phrase the promotions refuse ("hasta agotar stock", marketing H5). */
  | 'blockedPhrase'
  /** Something the catalogue does not offer (a product off sale, a full cylinder not sold). */
  | 'unavailable'
  /** Only the account that founded the distributor may choose it (inviting an owner). */
  | 'founderOnly';

/** One rejected form field. Screens map `code` to a message in Spanish. */
export interface FieldIssue {
  field: string;
  code: FieldIssueCode | SlugIssue;
  /** A value the form can offer instead; today only the closest visible tone of a brand colour. */
  suggestion?: string;
}

export type Validated<T> = { ok: true; value: T } | { ok: false; issues: FieldIssue[] };

export type Check = FieldIssue['code'] | null;

/** `min` 0 makes the text optional. Lengths are measured after the caller trims. */
export function checkText(value: string, min: number, max: number): Check {
  if (value.length === 0) return min > 0 ? 'required' : null;
  if (value.length < min) return 'tooShort';
  return value.length > max ? 'tooLong' : null;
}

/**
 * Text a person reads as written: no control or format characters anywhere (U+0000, U+0007,
 * U+200B, U+202E…), no white space at either end, and at least one letter or digit, so
 * punctuation, emoji or invisible characters alone are not a name. Same pattern as
 * `isVisibleText` in firebase/firestore.rules (RE2 there, so no look-ahead).
 */
const VISIBLE_TEXT =
  /^(?:[^\p{Z}\p{Cc}\p{Cf}][^\p{Cc}\p{Cf}]*)?[\p{L}\p{N}](?:[^\p{Cc}\p{Cf}]*[^\p{Z}\p{Cc}\p{Cf}])?$/u;

export function isVisibleText(value: string): boolean {
  return VISIBLE_TEXT.test(value);
}

/** `checkText`, and then `isVisibleText` (`invalid`): for names and brands people read. */
export function checkVisibleText(value: string, min: number, max: number): Check {
  const length = checkText(value, min, max);
  if (length) return length;
  if (value.length === 0) return null;
  return isVisibleText(value) ? null : 'invalid';
}

export function checkRange(value: number, min: number, max: number): Check {
  return Number.isFinite(value) && value >= min && value <= max ? null : 'outOfRange';
}

export function checkInteger(value: number, min: number, max: number): Check {
  return Number.isInteger(value) ? checkRange(value, min, max) : 'invalid';
}

export function checkPhone(value: string): Check {
  if (value === '') return 'required';
  return isValidPeruvianMobile(value) ? null : 'invalid';
}

/** A consent the person must give explicitly (a ticked box): anything but `true` is missing. */
export function checkConsent(value: unknown): Check {
  return value === true ? null : 'required';
}

export function collectIssues(checks: readonly (readonly [string, Check])[]): FieldIssue[] {
  return checks.flatMap(([field, code]) => (code ? [{ field, code }] : []));
}
