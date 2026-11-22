import {
  type Check,
  checkInteger,
  checkVisibleText,
  collectIssues,
  type Validated,
} from '../tenancy/field-checks';
import { ADJUSTMENT_NOTE_MAX_LENGTH, MAX_ADJUSTMENT_UNITS } from './constants';
import type { StockChange } from './plant-stock';

/**
 * What moved the plant stock. Only manual adjustments exist today; the approval of a departure
 * and the settlement of a shift (PLAN 5.2, 5.5) will add their own kinds, with the shift.
 */
export const STOCK_MOVEMENT_KINDS = ['adjustment'] as const;
export type StockMovementKind = (typeof STOCK_MOVEMENT_KINDS)[number];

/**
 * Why somebody adjusted the stock by hand:
 * - `count`: a physical count did not match what was recorded;
 * - `supplier`: full cylinders came from the supplier, or empty ones went to be refilled;
 * - `damaged`: a cylinder was damaged or leaking and left the stock;
 * - `other`: anything else, and then the note is required.
 */
export const ADJUSTMENT_REASONS = ['count', 'supplier', 'damaged', 'other'] as const;
export type AdjustmentReason = (typeof ADJUSTMENT_REASONS)[number];

/** The reason that cannot go without a note (firebase/firestore.rules checks the same). */
export const REASON_NEEDING_NOTE: AdjustmentReason = 'other';

/**
 * One line of the history of the plant stock (PLAN 3.4), at
 * `/distributors/{d}/stockMovements/{id}`. Written in the same request as the change of the
 * stock it describes, never edited or deleted.
 */
export interface StockMovement extends StockChange {
  id: string;
  kind: StockMovementKind;
  productId: string;
  reason: AdjustmentReason;
  note: string | null;
  /** What the stock held right after this movement. */
  fullAfter: number;
  emptyAfter: number;
  authorUid: string;
  /** The name of the author in the staff when it wrote it. */
  authorName: string;
  createdAt: Date;
}

/** A manual adjustment, as the form leaves it. */
export interface Adjustment extends StockChange {
  productId: string;
  reason: AdjustmentReason;
  note: string | null;
}

/** The adjustment form, as typed. */
export interface AdjustmentInput extends StockChange {
  productId: string;
  reason: AdjustmentReason;
  note?: string | null;
}

const SPACES = /\s+/g;

function checkDelta(delta: number): Check {
  return checkInteger(delta, -MAX_ADJUSTMENT_UNITS, MAX_ADJUSTMENT_UNITS);
}

function checkNote(note: string | null, reason: AdjustmentReason): Check {
  if (note === null) return reason === REASON_NEEDING_NOTE ? 'required' : null;
  return checkVisibleText(note, 1, ADJUSTMENT_NOTE_MAX_LENGTH);
}

function checkReason(reason: string): Check {
  return (ADJUSTMENT_REASONS as readonly string[]).includes(reason) ? null : 'invalid';
}

/**
 * Normalises and validates a manual adjustment: a known reason, a readable note (required for
 * `other`), whole changes within ±9 999, and something that changes. Whether the result stays
 * at or above zero depends on the stock of the moment: `applyStockChange` decides it inside the
 * transaction.
 */
export function prepareAdjustment(input: AdjustmentInput): Validated<Adjustment> {
  const tidyNote = (input.note ?? '').trim().replace(SPACES, ' ');
  const value: Adjustment = {
    productId: input.productId,
    reason: input.reason,
    note: tidyNote === '' ? null : tidyNote,
    fullDelta: input.fullDelta,
    emptyDelta: input.emptyDelta,
  };
  const issues = collectIssues([
    ['reason', checkReason(value.reason)],
    ['note', checkReason(value.reason) ? null : checkNote(value.note, value.reason)],
    ['fullDelta', checkDelta(value.fullDelta)],
    ['emptyDelta', checkDelta(value.emptyDelta)],
  ]);
  if (issues.length === 0 && value.fullDelta === 0 && value.emptyDelta === 0) {
    issues.push({ field: 'fullDelta', code: 'required' });
  }
  return issues.length > 0 ? { ok: false, issues } : { ok: true, value };
}
