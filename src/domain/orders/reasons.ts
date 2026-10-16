import { isVisibleText } from '../tenancy/field-checks';
import { ORDER_NOTE_MAX_LENGTH } from './constants';

/**
 * Why an order was cancelled (PLAN §11, 2026-10-16; the list is a proposal to confirm). Every
 * cancelled order carries one, so the reports of phase 8 can count them. `noEmptyCylinder` is the
 * one marketing §2.5 asks for ("Sin balón vacío").
 */
export const CANCEL_REASONS = [
  'customerRequest',
  'noEmptyCylinder',
  'customerUnreachable',
  'outOfStock',
  'outOfCoverage',
  'duplicate',
  'other',
] as const;
export type CancelReason = (typeof CANCEL_REASONS)[number];

/** The customer cancelling its own pending order types nothing: this is what gets recorded. */
export const CUSTOMER_CANCEL_REASON = 'customerRequest' satisfies CancelReason;

export function isCancelReason(value: unknown): value is CancelReason {
  return (CANCEL_REASONS as readonly unknown[]).includes(value);
}

export interface Cancellation {
  reason: CancelReason;
  /** Required with `other`; optional otherwise. Null when there is none. */
  note: string | null;
}

/** Text a person wrote as a note: visible, already trimmed, up to `ORDER_NOTE_MAX_LENGTH`. */
export function isOrderNote(note: string): boolean {
  return note.length <= ORDER_NOTE_MAX_LENGTH && isVisibleText(note);
}

export type CancellationIssue = 'reasonRequired' | 'customerReasonOnly' | 'invalidNote';

/**
 * What is wrong with a cancellation, or null. The office must pick a reason and explain `other`;
 * the customer may only record `customerRequest` (with an optional note).
 */
export function cancellationIssue(
  cancellation: Cancellation | null | undefined,
  byCustomer: boolean,
): CancellationIssue | null {
  if (!cancellation || !isCancelReason(cancellation.reason)) return 'reasonRequired';
  if (byCustomer && cancellation.reason !== CUSTOMER_CANCEL_REASON) return 'customerReasonOnly';
  if (cancellation.note === null) return cancellation.reason === 'other' ? 'invalidNote' : null;
  return isOrderNote(cancellation.note) ? null : 'invalidNote';
}
