import { PriceLockedError } from '../../domain/catalog/errors';
import {
  PromotionNotEditableError,
  PromotionNotFoundError,
  PromotionsFullError,
  StalePromotionError,
} from '../../domain/pricing/errors';
import type { Product } from '../../domain/catalog/product';
import type { SaleMode } from '../../domain/catalog/sale-mode';
import { formatMoney } from '../../domain/money/format';
import { dealIssues } from '../../domain/pricing/deal-checks';
import { listPriceOf } from '../../domain/pricing/discount';
import type { PromotionDeal } from '../../domain/pricing/promotion';
import { NothingChangedError } from '../../domain/tenancy/errors';
import type { FieldIssue } from '../../domain/tenancy/field-checks';
import { describeFieldIssue, describeTenancyError } from '../tenancy/tenancy-messages';

/** Said on the field and beside "Publicar promoción" (a button that only refuses says nothing). */
export const TOTAL_MISSING = 'Falta el tope de unidades.';

// Texts of docs/marketing/oferta-y-promociones.md §4.
const PROMOTION_MESSAGES: Record<string, string> = {
  'title:required': 'Escribe el nombre de la promoción.',
  'title:tooLong': 'El nombre admite hasta 40 caracteres.',
  'title:blockedPhrase':
    'Ese nombre no se puede usar: Hornilla no cuenta unidades. Usa la fecha de cierre y el máximo por pedido.',
  'conditions:tooLong': 'Las condiciones admiten hasta 140 caracteres.',
  'conditions:blockedPhrase':
    'Esa frase no se puede usar: Hornilla no cuenta unidades. Usa la fecha de cierre y el máximo por pedido.',
  'productIds:required': 'Elige al menos un producto.',
  'productIds:outOfRange': 'El precio especial es para un solo producto.',
  'productIds:unavailable': 'Elige productos que estén a la venta.',
  'saleMode:unavailable': 'Algún producto elegido no se vende como balón completo.',
  'saleMode:invalid': 'Esta promoción es solo para balón completo.',
  'priceCents:notBelow': 'El precio especial debe ser menor que el precio de lista.',
  'priceCents:outOfRange': 'El precio no puede ser S/ 0.00.',
  'percent:outOfRange': 'Elige un porcentaje entre 1 % y 30 %.',
  'amountCents:notBelow':
    'La rebaja no puede ser igual o mayor que el precio de un producto elegido.',
  'amountCents:outOfRange':
    'Escribe una rebaja mayor que S/ 0.00 y menor que el precio de cada producto elegido.',
  'maxUnitsPerOrder:notMultiple': 'El máximo por pedido debe completar grupos de la promoción.',
  'maxUnitsPerOrder:outOfRange': 'Revisa el máximo por pedido.',
  'totalUnits:required': TOTAL_MISSING,
  'startsAt:outOfRange': 'La promoción puede empezar ahora o en los próximos 30 días.',
  'endsAt:notAbove': 'La fecha de cierre debe ser posterior al inicio.',
  'endsAt:outOfRange': 'Una promoción dura como mucho 30 días.',
  'endsAt:invalid': 'Tus clientes ya vieron la fecha de cierre: solo puedes alargarla.',
};

export function describePromotionIssue(issue: FieldIssue): string {
  return PROMOTION_MESSAGES[`${issue.field}:${issue.code}`] ?? describeFieldIssue(issue);
}

/**
 * What is wrong with the number of the deal against the chosen products, said while typing:
 * a rebate that reaches the price (with the most it can be) or a special price not below the
 * list price. Null when it holds, or before a product is chosen.
 */
export function dealProblemOf(
  deal: PromotionDeal,
  products: readonly Product[],
  saleMode: SaleMode,
): string | null {
  const issue = dealIssues(deal, products, saleMode).find(({ code }) => code === 'notBelow');
  if (!issue || products.length === 0) return null;
  if (issue.field !== 'amountCents') return describePromotionIssue(issue);
  const lowest = Math.min(...products.map((product) => listPriceOf(product, saleMode) ?? 0));
  const most = formatMoney(Math.max(lowest - 1, 0), products[0]?.currency);
  return `La rebaja no puede ser igual o mayor que el precio de un producto elegido: como máximo ${most}.`;
}

const REFUSALS: Record<PromotionNotEditableError['reason'], string> = {
  switchedOff: 'Esta promoción está apagada. Usa "Repetir" para crear otra.',
  ended: 'Esta promoción ya terminó.',
  alreadyPublished: 'Esta promoción ya está publicada.',
  notPublished: 'Esta promoción no está publicada.',
};

/** Message in Spanish for anything a promotion action (or a price raise) can throw. */
export function describePromotionError(error: unknown): string {
  if (error instanceof PromotionsFullError) {
    return `Puedes tener hasta ${error.limit} promociones a la vez. Apaga una o espera a que termine.`;
  }
  if (error instanceof PromotionNotEditableError) return REFUSALS[error.reason];
  if (error instanceof PromotionNotFoundError) return 'Esa promoción ya no existe.';
  if (error instanceof StalePromotionError) {
    return 'Tus promociones cambiaron en otra pantalla. Vuelve a cargar e inténtalo de nuevo.';
  }
  if (error instanceof PriceLockedError) {
    return "Este producto tiene una promoción. Subir el precio agranda el 'antes' que ven tus clientes.";
  }
  if (error instanceof NothingChangedError) return 'No cambiaste nada.';
  return describeTenancyError(error);
}
