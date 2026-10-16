import type { Product } from '../catalog/product';
import type { LineRequest, OrderLine } from './lines';
import { cylinderCount, lineKey, listPriceOf } from './lines';
import { PricingMismatchError } from './errors';

/** What the promotions calculation returns for each line; the order adds the product's copy. */
export type PricedLine = Pick<
  OrderLine,
  | 'productId'
  | 'saleMode'
  | 'quantity'
  | 'listPriceCents'
  | 'unitPriceCents'
  | 'discountCents'
  | 'promotionId'
>;

export interface PricingInput {
  lines: readonly LineRequest[];
  products: readonly Product[];
  /** When the order is created: a promotion counts if it is in force at this instant. */
  at: Date;
}

/**
 * Prices the lines of an order. The real one applies the promotions of PLAN 3.5
 * (`priceOrder` in `src/domain/pricing/`, built on another branch); the order only depends on
 * this signature and checks what it returns (`checkPricedLines`).
 */
export type OrderPricer = (input: PricingInput) => PricedLine[];

/** Every line at its list price: the pricer while there are no promotions. */
export const listPricer: OrderPricer = ({ lines, products }) =>
  lines.map((line) => {
    const product = products.find((p) => p.id === line.productId);
    const listPriceCents = product ? listPriceOf(product, line.saleMode) : null;
    if (listPriceCents === null) throw new PricingMismatchError(`no price for ${lineKey(line)}`);
    return {
      ...line,
      listPriceCents,
      unitPriceCents: listPriceCents,
      discountCents: 0,
      promotionId: null,
    };
  });

const isCents = (value: number) => Number.isSafeInteger(value) && value >= 0;

/** Why one priced line breaks the contract, or null. */
function pricedLineFault(line: PricedLine, products: readonly Product[]): string | null {
  const product = products.find((p) => p.id === line.productId);
  const list = product ? listPriceOf(product, line.saleMode) : null;
  if (list === null || line.listPriceCents !== list) return 'list price is not the catalogue one';
  if (!Number.isSafeInteger(line.quantity) || line.quantity < 1) return 'bad quantity';
  if (!isCents(line.unitPriceCents) || line.unitPriceCents > list) return 'bad unit price';
  if (line.promotionId === null && line.unitPriceCents !== list)
    return 'discount without promotion';
  if (line.discountCents !== (list - line.unitPriceCents) * line.quantity) return 'bad discount';
  return null;
}

function unitsByKey(lines: readonly (LineRequest | PricedLine)[]): Map<string, number> {
  const units = new Map<string, number>();
  for (const line of lines)
    units.set(lineKey(line), (units.get(lineKey(line)) ?? 0) + line.quantity);
  return units;
}

/**
 * Throws `PricingMismatchError` unless the priced lines are exactly the units asked for, at the
 * catalogue's list price, with a whole non-negative unit price no higher than the list one, a
 * zero price only inside a promotion and the discount that follows from both. A pricer that
 * breaks this is a bug, never something to show the customer.
 */
export function checkPricedLines(
  requests: readonly LineRequest[],
  priced: readonly PricedLine[],
  products: readonly Product[],
): void {
  const fault = priced.map((line) => pricedLineFault(line, products)).find((f) => f !== null);
  if (fault) throw new PricingMismatchError(fault);
  const asked = unitsByKey(requests);
  const given = unitsByKey(priced);
  const same =
    asked.size === given.size && [...asked].every(([key, units]) => given.get(key) === units);
  if (!same || cylinderCount(priced) !== cylinderCount(requests)) {
    throw new PricingMismatchError('the priced units are not the ones asked for');
  }
}

/** The frozen lines of a new order: priced by `pricer`, checked, with the product's copy. */
export function freezeLines(input: PricingInput & { pricer: OrderPricer }): OrderLine[] {
  const priced = input.pricer(input);
  checkPricedLines(input.lines, priced, input.products);
  return priced.map((line) => {
    const product = input.products.find((p) => p.id === line.productId);
    if (!product) throw new PricingMismatchError(`unknown product ${line.productId}`);
    return { ...line, brand: product.brand, name: product.name, weightKg: product.weightKg };
  });
}
