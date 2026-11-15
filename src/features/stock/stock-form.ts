import type { AdjustmentReason } from '../../domain/stock/movement';
import {
  adjustmentToReach,
  applyStockChange,
  type PlantStock,
  type StockChange,
  type StockLevels,
} from '../../domain/stock/plant-stock';
import { InvalidInputError } from '../../domain/tenancy/errors';
import { adjustmentFieldMessagesOf, describeStockError } from './stock-messages';

/**
 * The adjustment form as typed (PLAN 3.4). What the two numbers mean depends on the reason:
 * - `count`: the totals counted (the domain works out the difference);
 * - `supplier`: full ones that arrived and empty ones that left, both as positive numbers;
 * - `damaged`: full and empty ones that leave the stock, as positive numbers;
 * - `other`: the change itself, with its sign ("-2", "+3").
 */
export interface StockForm {
  reason: AdjustmentReason;
  full: string;
  empty: string;
  note: string;
}

export type StockFormField = keyof StockForm;
export type StockFormErrors = Partial<Record<StockFormField | 'form', string>>;

/** The labels of the two numbers for each reason. */
export const STOCK_FIELD_LABELS: Record<AdjustmentReason, { full: string; empty: string }> = {
  count: { full: 'Llenos contados', empty: 'Vacíos contados' },
  supplier: { full: 'Llenos que llegaron', empty: 'Vacíos que se llevaron' },
  damaged: { full: 'Llenos que salen', empty: 'Vacíos que salen' },
  other: { full: 'Cambio en llenos', empty: 'Cambio en vacíos' },
};

const WHOLE = /^\d+$/;
const SIGNED = /^[+-]?\d+$/;
const MINUS_SIGNS = /[−–]/g;
const FORMAT: Record<'unsigned' | 'signed', string> = {
  unsigned: 'Escribe un número entero de balones, por ejemplo 3.',
  signed: 'Escribe un número entero; con un menos delante si bajan, por ejemplo -2.',
};

/** Domain field → form field. */
const FORM_FIELD: Record<string, StockFormField> = { fullDelta: 'full', emptyDelta: 'empty' };

export function stockFormFor(reason: AdjustmentReason, stock: StockLevels): StockForm {
  const isCount = reason === 'count';
  return {
    reason,
    full: isCount ? String(stock.full) : '',
    empty: isCount ? String(stock.empty) : '',
    note: '',
  };
}

/** A number of the form; a blank one is zero except in a count, where it is the total. */
function numberOf(text: string, reason: AdjustmentReason): number | null {
  const typed = text.trim().replace(MINUS_SIGNS, '-');
  if (typed === '' && reason !== 'count') return 0;
  const pattern = reason === 'other' ? SIGNED : WHOLE;
  return pattern.test(typed) ? Number(typed) : null;
}

/** −n, never −0 (a side that does not move stays a plain zero). */
const minus = (count: number) => (count === 0 ? 0 : -count);

export type ReadStockForm =
  | { ok: true; change: StockChange; counted: StockLevels | null }
  | { ok: false; errors: StockFormErrors };

/** The change the form asks for, against the stock as the screen has it. */
export function readStockForm(form: StockForm, stock: StockLevels): ReadStockForm {
  const full = numberOf(form.full, form.reason);
  const empty = numberOf(form.empty, form.reason);
  const message = formatMessageOf(form.reason);
  if (full === null || empty === null) {
    const errors: StockFormErrors = {};
    if (full === null) errors.full = message;
    if (empty === null) errors.empty = message;
    return { ok: false, errors };
  }
  switch (form.reason) {
    case 'count':
      return {
        ok: true,
        change: adjustmentToReach(stock, { full, empty }),
        counted: { full, empty },
      };
    case 'supplier':
      return { ok: true, change: { fullDelta: full, emptyDelta: minus(empty) }, counted: null };
    case 'damaged':
      return {
        ok: true,
        change: { fullDelta: minus(full), emptyDelta: minus(empty) },
        counted: null,
      };
    case 'other':
      return { ok: true, change: { fullDelta: full, emptyDelta: empty }, counted: null };
  }
}

function formatMessageOf(reason: AdjustmentReason): string {
  return reason === 'other' ? FORMAT.signed : FORMAT.unsigned;
}

/** What the stock would hold after `change`; null when it would go below zero or over the cap. */
export function levelsAfter(stock: PlantStock, change: StockChange): StockLevels | null {
  try {
    return applyStockChange(stock, change);
  } catch {
    return null;
  }
}

/** Whatever an adjustment threw, as messages on the fields (or on the whole form). */
export function stockFormErrorsOf(error: unknown): StockFormErrors {
  if (!(error instanceof InvalidInputError)) return { form: describeStockError(error) };
  const errors: StockFormErrors = {};
  for (const [field, message] of Object.entries(adjustmentFieldMessagesOf(error))) {
    errors[FORM_FIELD[field] ?? (field as StockFormField)] = message;
  }
  return errors;
}
