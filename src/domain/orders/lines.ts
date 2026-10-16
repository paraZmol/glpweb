import type { Product } from '../catalog/product';
import type { SaleMode } from '../catalog/sale-mode';
import { SALE_MODES } from '../catalog/sale-mode';
import { MAX_ORDER_LINES } from './constants';

/** What the customer (or the office) asks for: a product, how it is sold, how many. */
export interface LineRequest {
  productId: string;
  saleMode: SaleMode;
  quantity: number;
}

/**
 * One line of an order, frozen when the order is created (glp-domain §1 and §5b): prices and the
 * copy of the product never change afterwards, whatever happens to the catalogue or the
 * promotion. A line has a single price per unit; a free unit of "lleva 2 paga 1" comes in a line
 * of its own at zero (PLAN §11, 2026-10-16).
 */
export interface OrderLine extends LineRequest {
  brand: string;
  name: string;
  weightKg: number;
  /** List price of one unit for that sale mode when the order was made. */
  listPriceCents: number;
  /** What one unit costs in this order: the list price, or the promotion's. */
  unitPriceCents: number;
  /** `(listPriceCents - unitPriceCents) * quantity`, stored so reports do not recompute it. */
  discountCents: number;
  /** The promotion that set the price; null at list price. */
  promotionId: string | null;
}

export type LineRequestIssue =
  | 'empty'
  | 'tooManyLines'
  | 'duplicateLine'
  | 'invalidQuantity'
  | 'invalidSaleMode'
  | 'unknownProduct'
  | 'productOff'
  | 'fullNotSold'
  | 'tooManyCylinders';

/** Key of a product sold one way: the same product as refill and as full are two lines. */
export function lineKey(line: Pick<LineRequest, 'productId' | 'saleMode'>): string {
  return `${line.productId}:${line.saleMode}`;
}

export function cylinderCount(lines: readonly Pick<LineRequest, 'quantity'>[]): number {
  return lines.reduce((sum, line) => sum + line.quantity, 0);
}

/** The list price of one unit of `product` sold as `mode`, or null when it is not sold that way. */
export function listPriceOf(product: Product, mode: SaleMode): number | null {
  return mode === 'full' ? product.fullPriceCents : product.refillPriceCents;
}

function requestIssue(request: LineRequest, products: readonly Product[]): LineRequestIssue | null {
  if (!Number.isSafeInteger(request.quantity) || request.quantity < 1) return 'invalidQuantity';
  if (!SALE_MODES.includes(request.saleMode)) return 'invalidSaleMode';
  const product = products.find((p) => p.id === request.productId);
  if (!product) return 'unknownProduct';
  if (!product.active) return 'productOff';
  return listPriceOf(product, request.saleMode) === null ? 'fullNotSold' : null;
}

/**
 * What is wrong with the lines asked for, or null: at least one, at most `MAX_ORDER_LINES`, one
 * line per product and sale mode, whole quantities, active products, a full cylinder only where
 * the distributor sells it, and no more cylinders than `maxCylinders` (glp-domain §1).
 */
export function lineRequestsIssue(
  requests: readonly LineRequest[],
  products: readonly Product[],
  maxCylinders: number,
): LineRequestIssue | null {
  if (requests.length === 0) return 'empty';
  if (requests.length > MAX_ORDER_LINES) return 'tooManyLines';
  if (new Set(requests.map(lineKey)).size !== requests.length) return 'duplicateLine';
  for (const request of requests) {
    const issue = requestIssue(request, products);
    if (issue) return issue;
  }
  return cylinderCount(requests) > maxCylinders ? 'tooManyCylinders' : null;
}

/** Cylinders of each product the order takes out of stock: refill and full alike. */
export function cylindersByProduct(
  lines: readonly Pick<LineRequest, 'productId' | 'quantity'>[],
): Map<string, number> {
  const byProduct = new Map<string, number>();
  for (const line of lines) {
    byProduct.set(line.productId, (byProduct.get(line.productId) ?? 0) + line.quantity);
  }
  return byProduct;
}
