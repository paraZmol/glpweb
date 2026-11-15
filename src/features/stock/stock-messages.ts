import { ADJUSTMENT_NOTE_MAX_LENGTH, MAX_ADJUSTMENT_UNITS } from '../../domain/stock/constants';
import {
  NegativeStockError,
  StockCapError,
  StockChangedError,
  StockProductNotFoundError,
} from '../../domain/stock/errors';
import type { StockLevels } from '../../domain/stock/plant-stock';
import type { AdjustmentReason } from '../../domain/stock/movement';
import { InvalidInputError, NothingChangedError } from '../../domain/tenancy/errors';
import type { FieldIssue } from '../../domain/tenancy/field-checks';
import { describeFieldIssue, describeTenancyError } from '../tenancy/tenancy-messages';

/** How each reason of an adjustment is called on screen. */
export const ADJUSTMENT_REASON_LABELS: Record<AdjustmentReason, string> = {
  count: 'Conteo físico',
  supplier: 'Proveedor: llegaron llenos o se llevaron vacíos',
  damaged: 'Balón dañado o con fuga',
  other: 'Otro motivo',
};

const CHANGE_RANGE = `Escribe un número entero de balones, hasta ${MAX_ADJUSTMENT_UNITS} de una vez.`;

const ADJUSTMENT_MESSAGES: Record<string, string> = {
  'reason:invalid': 'Elige el motivo del ajuste.',
  'note:required': 'Cuenta en una nota por qué ajustas el stock.',
  'note:tooLong': `La nota admite hasta ${ADJUSTMENT_NOTE_MAX_LENGTH} caracteres.`,
  'note:invalid': 'Escribe la nota con letras o números, sin caracteres invisibles.',
  'fullDelta:outOfRange': CHANGE_RANGE,
  'fullDelta:invalid': CHANGE_RANGE,
  'fullDelta:required': 'Indica cuántos llenos o vacíos cambian.',
  'emptyDelta:outOfRange': CHANGE_RANGE,
  'emptyDelta:invalid': CHANGE_RANGE,
};

/** Message in Spanish for one rejected field of the adjustment form. */
export function describeAdjustmentIssue(issue: FieldIssue): string {
  return ADJUSTMENT_MESSAGES[`${issue.field}:${issue.code}`] ?? describeFieldIssue(issue);
}

/** Field name → message, to paint the adjustment form after an `InvalidInputError`. */
export function adjustmentFieldMessagesOf(error: unknown): Record<string, string> {
  if (!(error instanceof InvalidInputError)) return {};
  return Object.fromEntries(
    error.issues.map((issue) => [issue.field, describeAdjustmentIssue(issue)]),
  );
}

/** "1 lleno y 12 vacíos". */
export function levelsText({ full, empty }: StockLevels): string {
  return `${full} ${full === 1 ? 'lleno' : 'llenos'} y ${empty} ${empty === 1 ? 'vacío' : 'vacíos'}`;
}

/** Message in Spanish for anything a stock action can throw. */
export function describeStockError(error: unknown): string {
  if (error instanceof StockChangedError) {
    return `El stock cambió mientras contabas: ahora figuran ${levelsText(error.now)}. Revisa tu conteo y vuelve a guardar.`;
  }
  if (error instanceof NegativeStockError) {
    return 'Con ese ajuste el stock quedaría por debajo de cero. Revisa las cantidades.';
  }
  if (error instanceof StockCapError) {
    return `El stock admite hasta ${error.cap} balones de cada tipo.`;
  }
  if (error instanceof StockProductNotFoundError) {
    return 'Ese producto ya no está en tu catálogo. Vuelve a cargar la lista.';
  }
  if (error instanceof NothingChangedError)
    return 'El conteo coincide con el stock: no hay nada que ajustar.';
  return describeTenancyError(error);
}
