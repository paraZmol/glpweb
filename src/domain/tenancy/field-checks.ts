import { isValidPeruvianMobile } from './contact';
import type { SlugIssue } from './slug';

export type FieldIssueCode = 'required' | 'tooLong' | 'tooShort' | 'outOfRange' | 'invalid';

/** One rejected form field. Screens map `code` to a message in Spanish. */
export interface FieldIssue {
  field: string;
  code: FieldIssueCode | SlugIssue;
}

export type Validated<T> = { ok: true; value: T } | { ok: false; issues: FieldIssue[] };

export type Check = FieldIssue['code'] | null;

/** `min` 0 makes the text optional. Lengths are measured after the caller trims. */
export function checkText(value: string, min: number, max: number): Check {
  if (value.length === 0) return min > 0 ? 'required' : null;
  if (value.length < min) return 'tooShort';
  return value.length > max ? 'tooLong' : null;
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

export function collectIssues(checks: readonly (readonly [string, Check])[]): FieldIssue[] {
  return checks.flatMap(([field, code]) => (code ? [{ field, code }] : []));
}
