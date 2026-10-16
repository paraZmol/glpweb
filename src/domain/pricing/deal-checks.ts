import type { Product } from '../catalog/product';
import type { SaleMode } from '../catalog/sale-mode';
import { checkPriceCents } from '../catalog/product-input';
import { type Check, checkInteger, type FieldIssue } from '../tenancy/field-checks';
import {
  BUY_X_PAY_Y_OPTIONS,
  MAX_PERCENT_OFF,
  MAX_TOTAL_UNITS,
  MAX_UNITS_PER_ORDER,
  MIN_TOTAL_UNITS,
  MIN_UNITS_PER_ORDER,
} from './constants';
import { listPriceOf } from './discount';
import type { PromotionDeal } from './promotion';

const issue = (field: string, code: Check): FieldIssue[] => (code ? [{ field, code }] : []);

/** The list prices the deal will be compared with (products already checked to sell that way). */
function listPrices(products: readonly Product[], saleMode: SaleMode): number[] {
  return products.map((product) => listPriceOf(product, saleMode) ?? 0);
}

/**
 * A promoted price must be below the list price of every product it covers (H2): equal or above
 * is no discount, and `priceOrder` would not apply it anyway.
 */
function belowAll(amountCents: number, prices: readonly number[]): Check {
  return prices.every((price) => amountCents < price) ? null : 'notBelow';
}

function checkFixedPrice(
  deal: Extract<PromotionDeal, { type: 'fixedPrice' }>,
  saleMode: SaleMode,
  prices: readonly number[],
): FieldIssue[] {
  if (deal.priceSource === 'refill') {
    // "Balón completo al precio del gas" only exists for the full cylinder (P3).
    return issue('saleMode', saleMode === 'full' ? null : 'invalid');
  }
  return issue('priceCents', checkPriceCents(deal.priceCents) ?? belowAll(deal.priceCents, prices));
}

function checkAmount(amountCents: number, prices: readonly number[]): Check {
  return checkPriceCents(amountCents) ?? belowAll(amountCents, prices);
}

const isOffered = (buyUnits: number, payUnits: number) =>
  BUY_X_PAY_Y_OPTIONS.some(
    (option) => option.buyUnits === buyUnits && option.payUnits === payUnits,
  );

/** The parameters of the kind, against the products it covers. */
export function dealIssues(
  deal: PromotionDeal,
  products: readonly Product[],
  saleMode: SaleMode,
): FieldIssue[] {
  const prices = listPrices(products, saleMode);
  switch (deal.type) {
    case 'fixedPrice':
      return checkFixedPrice(deal, saleMode, prices);
    case 'percentOff':
      return issue('percent', checkInteger(deal.percent, 1, MAX_PERCENT_OFF));
    case 'amountOff':
      return issue('amountCents', checkAmount(deal.amountCents, prices));
    case 'buyXPayY':
      return issue('buyUnits', isOffered(deal.buyUnits, deal.payUnits) ? null : 'invalid');
  }
}

/** Whether the kind can only be published with a total cap of units (D5, D15). */
export function needsTotalCap(deal: PromotionDeal): boolean {
  return deal.type === 'buyXPayY' || (deal.type === 'fixedPrice' && deal.priceSource === 'refill');
}

function checkMaxPerOrder(deal: PromotionDeal, maxUnitsPerOrder: number): Check {
  const range = checkInteger(maxUnitsPerOrder, MIN_UNITS_PER_ORDER, MAX_UNITS_PER_ORDER);
  if (range) return range;
  if (deal.type === 'fixedPrice' && deal.priceSource === 'refill') {
    return maxUnitsPerOrder === 1 ? null : 'outOfRange';
  }
  if (deal.type === 'buyXPayY')
    return maxUnitsPerOrder % deal.buyUnits === 0 ? null : 'notMultiple';
  return null;
}

function checkTotal(deal: PromotionDeal, totalUnits: number | null): Check {
  if (totalUnits === null) return needsTotalCap(deal) ? 'required' : null;
  return checkInteger(totalUnits, MIN_TOTAL_UNITS, MAX_TOTAL_UNITS);
}

/** The cap per order and the total cap, as the kind demands them. */
export function unitIssues(
  deal: PromotionDeal,
  maxUnitsPerOrder: number,
  totalUnits: number | null,
): FieldIssue[] {
  return [
    ...issue('maxUnitsPerOrder', checkMaxPerOrder(deal, maxUnitsPerOrder)),
    ...issue('totalUnits', checkTotal(deal, totalUnits)),
  ];
}
