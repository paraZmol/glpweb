import { defaultProductName, type Product, type ProductPatch } from '../../domain/catalog/product';
import type { ProductInput } from '../../domain/catalog/product-input';
import { parseMoneyCents } from '../../domain/money/parse';
import { InvalidInputError } from '../../domain/tenancy/errors';
import { describeCatalogError, productFieldMessagesOf } from './catalog-messages';

/** The product form as typed: every value is the text of its field (PLAN 3.1). */
export interface ProductForm {
  brand: string;
  /** `#rrggbb`, or empty for no colour. */
  brandColor: string;
  /** Whole kilograms, as typed; fixed once the product exists. */
  weightKg: string;
  /** Blank takes "Balón {peso} kg". */
  name: string;
  /** Soles as the person writes them: "38", "38.5", "38,50". */
  refillPrice: string;
  /** "También vendo balón completo". */
  sellsFull: boolean;
  fullPrice: string;
}

export type ProductFormField = keyof ProductForm;
export type ProductFormErrors = Partial<Record<ProductFormField | 'form', string>>;

const WEIGHT_FORMAT = 'Escribe el peso en kilos enteros, por ejemplo 10.';
const PRICE_FORMAT = 'Escribe el precio en soles, por ejemplo 52.00.';
const FULL_PRICE_MISSING = 'Escribe el precio del balón completo, o desmarca la casilla.';
const WHOLE_NUMBER = /^\d+$/;
const CENTS_PER_SOL = 100;
const DEFAULT_WEIGHT_KG = '10';

/** Domain field → form field, where their names differ. */
const FORM_FIELD: Record<string, ProductFormField> = {
  refillPriceCents: 'refillPrice',
  fullPriceCents: 'fullPrice',
};

export function emptyProductForm(): ProductForm {
  return {
    brand: '',
    brandColor: '',
    weightKg: DEFAULT_WEIGHT_KG,
    name: '',
    refillPrice: '',
    sellsFull: false,
    fullPrice: '',
  };
}

/** Cents as a plain amount for an input: 5250 → "52.50" (no symbol, no thousands comma). */
export function centsToInput(cents: number): string {
  return `${Math.floor(cents / CENTS_PER_SOL)}.${String(cents % CENTS_PER_SOL).padStart(2, '0')}`;
}

/** The form of an existing product, ready to edit. */
export function productFormOf(product: Product): ProductForm {
  return {
    brand: product.brand,
    brandColor: product.brandColor ?? '',
    weightKg: String(product.weightKg),
    name: product.name,
    refillPrice: centsToInput(product.refillPriceCents),
    sellsFull: product.fullPriceCents !== null,
    fullPrice: product.fullPriceCents === null ? '' : centsToInput(product.fullPriceCents),
  };
}

export type ReadForm = { ok: true; input: ProductInput } | { ok: false; errors: ProductFormErrors };

/**
 * Turns the typed texts into a product: weight and prices are read here (format only); ranges
 * and "the full cylinder costs more" are the domain's (`addProduct` and `editProduct` check
 * them before anything is written, and `productFormErrorsOf` paints what they refuse).
 */
export function readProductForm(form: ProductForm): ReadForm {
  const errors: ProductFormErrors = {};
  const weight = form.weightKg.trim();
  if (!WHOLE_NUMBER.test(weight)) errors.weightKg = WEIGHT_FORMAT;
  const refill = parseMoneyCents(form.refillPrice);
  if (refill === null) errors.refillPrice = PRICE_FORMAT;
  const full = form.sellsFull ? parseMoneyCents(form.fullPrice) : null;
  if (form.sellsFull && full === null) {
    errors.fullPrice = form.fullPrice.trim() === '' ? FULL_PRICE_MISSING : PRICE_FORMAT;
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    input: {
      brand: form.brand,
      brandColor: form.brandColor,
      weightKg: Number(weight),
      name: form.name,
      refillPriceCents: refill ?? 0,
      fullPriceCents: full,
    },
  };
}

/**
 * What an edit asks to change; the domain keeps only what really differs. A blank name goes
 * back to the default one, as it does for a new product.
 */
export function productPatchOf(input: ProductInput): ProductPatch {
  const { brand, brandColor = null, refillPriceCents, fullPriceCents } = input;
  const name = input.name?.trim() ? input.name : defaultProductName(input.weightKg);
  return { brand, brandColor, name, refillPriceCents, fullPriceCents };
}

/** Messages to paint after `addProduct` or `editProduct` refused: per field, or for the form. */
export function productFormErrorsOf(error: unknown): ProductFormErrors {
  if (error instanceof InvalidInputError) {
    const byField = productFieldMessagesOf(error);
    return Object.fromEntries(
      Object.entries(byField).map(([field, message]) => [FORM_FIELD[field] ?? field, message]),
    );
  }
  return { form: describeCatalogError(error) };
}
