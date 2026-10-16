import {
  CatalogFullError,
  PriceLockedError,
  ProductNotFoundError,
  StaleCatalogError,
} from '../../domain/catalog/errors';
import { MAX_WEIGHT_KG, MIN_WEIGHT_KG } from '../../domain/catalog/constants';
import { InvalidInputError, NothingChangedError } from '../../domain/tenancy/errors';
import type { FieldIssue } from '../../domain/tenancy/field-checks';
import { describeFieldIssue, describeTenancyError } from '../tenancy/tenancy-messages';

const PRICE_RANGE = 'Escribe un precio entre S/ 0.01 y S/ 999.00.';
const PRICE_FORMAT = 'Escribe el precio en soles, por ejemplo 52.00.';

// Names fixed by docs/marketing/oferta-y-promociones.md §2.1: "Recarga" and "Balón completo".
const PRODUCT_MESSAGES: Record<string, string> = {
  'brand:required': 'Escribe la marca del gas.',
  'brand:tooLong': 'La marca admite hasta 30 caracteres.',
  'brand:invalid': 'Escribe la marca con letras o números, sin caracteres invisibles.',
  'name:invalid': 'Escribe el nombre con letras o números, sin caracteres invisibles.',
  'weightKg:outOfRange': `Escribe el peso en kilos, de ${MIN_WEIGHT_KG} a ${MAX_WEIGHT_KG}.`,
  'weightKg:invalid': 'Escribe el peso en kilos enteros, por ejemplo 10.',
  'name:tooShort': 'El nombre necesita al menos 2 caracteres.',
  'name:tooLong': 'El nombre admite hasta 60 caracteres.',
  'refillPriceCents:outOfRange': PRICE_RANGE,
  'refillPriceCents:invalid': PRICE_FORMAT,
  'fullPriceCents:outOfRange': PRICE_RANGE,
  'fullPriceCents:invalid': PRICE_FORMAT,
  'fullPriceCents:notAbove':
    'El balón completo lleva gas y envase: debe costar más que la recarga.',
};

/** Message in Spanish for one rejected field of the product form. */
export function describeProductIssue(issue: FieldIssue): string {
  return PRODUCT_MESSAGES[`${issue.field}:${issue.code}`] ?? describeFieldIssue(issue);
}

/** Field name → message, to paint the product form after an `InvalidInputError`. */
export function productFieldMessagesOf(error: unknown): Record<string, string> {
  if (!(error instanceof InvalidInputError)) return {};
  return Object.fromEntries(
    error.issues.map((issue) => [issue.field, describeProductIssue(issue)]),
  );
}

/** Message in Spanish for anything a catalogue action can throw. */
export function describeCatalogError(error: unknown): string {
  if (error instanceof CatalogFullError) {
    return `Puedes tener hasta ${error.limit} productos, también los que no están a la venta.`;
  }
  if (error instanceof ProductNotFoundError) {
    return 'Ese producto ya no está en tu catálogo. Vuelve a cargar la lista.';
  }
  if (error instanceof StaleCatalogError) {
    return 'Tu catálogo cambió en otra pantalla. Vuelve a cargar la lista e inténtalo de nuevo.';
  }
  if (error instanceof NothingChangedError) return 'No cambiaste nada.';
  if (error instanceof PriceLockedError) {
    return "Este producto tiene una promoción. Subir el precio agranda el 'antes' que ven tus clientes. Podrás subirlo cuando termine.";
  }
  return describeTenancyError(error);
}
