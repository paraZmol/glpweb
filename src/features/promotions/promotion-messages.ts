import { PriceLockedError } from '../../domain/catalog/errors';
import {
  PromotionNotEditableError,
  PromotionNotFoundError,
  PromotionsFullError,
  StalePromotionError,
} from '../../domain/pricing/errors';
import { NothingChangedError } from '../../domain/tenancy/errors';
import type { FieldIssue } from '../../domain/tenancy/field-checks';
import { describeFieldIssue, describeTenancyError } from '../tenancy/tenancy-messages';

// Texts of docs/marketing/oferta-y-promociones.md §4.
const PROMOTION_MESSAGES: Record<string, string> = {
  'title:required': 'Escribe el nombre de la promoción.',
  'title:tooLong': 'El nombre admite hasta 40 caracteres.',
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
  'maxUnitsPerOrder:notMultiple': 'El máximo por pedido debe completar grupos de la promoción.',
  'maxUnitsPerOrder:outOfRange': 'Revisa el máximo por pedido.',
  'totalUnits:required': 'Esta promoción necesita un tope total de unidades.',
  'startsAt:outOfRange': 'La promoción puede empezar ahora o en los próximos 30 días.',
  'endsAt:notAbove': 'La fecha de cierre debe ser posterior al inicio.',
  'endsAt:outOfRange': 'Una promoción dura como mucho 30 días.',
  'endsAt:invalid': 'Tus clientes ya vieron la fecha de cierre: solo puedes alargarla.',
};

export function describePromotionIssue(issue: FieldIssue): string {
  return PROMOTION_MESSAGES[`${issue.field}:${issue.code}`] ?? describeFieldIssue(issue);
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
