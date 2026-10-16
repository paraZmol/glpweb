import type { SaleMode } from '../catalog/sale-mode';
import { appliesTo, type Discount, discountOf, listPriceOf, type PricedProduct } from './discount';
import { InvalidQuantityError, UnpricedItemError } from './errors';
import { type Promotion, remainingUnits } from './promotion';

/** What the customer (or the dispatcher) asks for: units of a product sold one way. */
export interface OrderItem {
  productId: string;
  saleMode: SaleMode;
  quantity: number;
}

/**
 * One line of a priced order, what the order freezes (glp-domain §5b; PLAN §11, 2026-10-16):
 * the list price of one unit (the honest "before"), the units, the discount of the whole line,
 * what the line costs and the promotion it took. No unit price: in "lleva 3, paga 2" it is not
 * whole cents.
 */
export interface PricedLine extends OrderItem {
  listPriceCents: number;
  discountCents: number;
  totalCents: number;
  promotionId: string | null;
}

export interface PricedOrder {
  lines: PricedLine[];
  /** Sum at list prices. */
  listTotalCents: number;
  discountCents: number;
  totalCents: number;
}

interface Pending extends OrderItem {
  index: number;
  product: PricedProduct;
  listPriceCents: number;
}

const keyOf = (item: Pick<OrderItem, 'productId' | 'saleMode'>) =>
  `${item.productId}:${item.saleMode}`;

/** One entry per product and way of selling, in the order they first appear. */
function merge(items: readonly OrderItem[]): OrderItem[] {
  const merged = new Map<string, OrderItem>();
  for (const item of items) {
    if (!Number.isInteger(item.quantity) || item.quantity < 1) {
      throw new InvalidQuantityError(item.quantity);
    }
    const seen = merged.get(keyOf(item));
    merged.set(keyOf(item), { ...item, quantity: (seen?.quantity ?? 0) + item.quantity });
  }
  return [...merged.values()];
}

function pending(item: OrderItem, index: number, products: readonly PricedProduct[]): Pending {
  const product = products.find((candidate) => candidate.id === item.productId);
  const listPriceCents = product?.active ? listPriceOf(product, item.saleMode) : null;
  if (!product || listPriceCents === null) {
    throw new UnpricedItemError(item.productId, item.saleMode);
  }
  return { ...item, index, product, listPriceCents };
}

type Capacity = Map<string, number>;

/** Units each promotion may still give in this order: its cap per order, and what is left. */
function capacityOf(promotions: readonly Promotion[]): Capacity {
  return new Map(
    promotions.map((promotion) => [
      promotion.id,
      Math.min(promotion.maxUnitsPerOrder, remainingUnits(promotion) ?? Infinity),
    ]),
  );
}

interface Choice extends Discount {
  promotionId: string;
}

/** The promotion that leaves this line cheapest; ties go to the lowest slot (deterministic). */
function bestChoice(
  item: Pending,
  promotions: readonly Promotion[],
  capacity: Capacity,
  now: Date,
): Choice | null {
  let best: Choice | null = null;
  for (const promotion of promotions) {
    if (!appliesTo(promotion, item.product, item.saleMode, now)) continue;
    const units = Math.min(item.quantity, capacity.get(promotion.id) ?? 0);
    const discount = discountOf(promotion.deal, item.product, item.listPriceCents, units);
    if (discount.discountCents <= 0) continue;
    const better =
      best === null ||
      discount.discountCents > best.discountCents ||
      (discount.discountCents === best.discountCents && promotion.id < best.promotionId);
    if (better) best = { ...discount, promotionId: promotion.id };
  }
  return best;
}

function linesOf(item: Pending, choice: Choice | null): PricedLine[] {
  const base = { productId: item.productId, saleMode: item.saleMode };
  const line = (quantity: number, discountCents: number, promotionId: string | null) => ({
    ...base,
    quantity,
    listPriceCents: item.listPriceCents,
    discountCents,
    totalCents: quantity * item.listPriceCents - discountCents,
    promotionId,
  });
  if (choice === null) return [line(item.quantity, 0, null)];
  const rest = item.quantity - choice.units;
  const promoted = line(choice.units, choice.discountCents, choice.promotionId);
  return rest > 0 ? [promoted, line(rest, 0, null)] : [promoted];
}

/**
 * Prices an order at `now` (glp-domain §5b): one promotion per line at most, never two on the
 * same units; the one that leaves the line cheapest wins. A promotion's cap per order counts the
 * whole order, so dearer lines take it first (more discount for the customer); the units beyond
 * a cap go in a line of their own at list price. Integer cents throughout. Throws
 * `UnpricedItemError` for a product not on sale that way and `InvalidQuantityError`.
 * The order rules of phase 4 check every line against the same promotion and product.
 */
export function priceOrder(
  items: readonly OrderItem[],
  products: readonly PricedProduct[],
  promotions: readonly Promotion[],
  now: Date,
): PricedOrder {
  const queue = merge(items).map((item, index) => pending(item, index, products));
  const capacity = capacityOf(promotions);
  const byIndex = new Map<number, PricedLine[]>();
  const dearestFirst = [...queue].sort(
    (a, b) => b.listPriceCents - a.listPriceCents || a.index - b.index,
  );
  for (const item of dearestFirst) {
    const choice = bestChoice(item, promotions, capacity, now);
    if (choice)
      capacity.set(choice.promotionId, (capacity.get(choice.promotionId) ?? 0) - choice.units);
    byIndex.set(item.index, linesOf(item, choice));
  }
  const lines = queue.flatMap((item) => byIndex.get(item.index) ?? []);
  const sum = (pick: (line: PricedLine) => number) =>
    lines.reduce((total, line) => total + pick(line), 0);
  return {
    lines,
    listTotalCents: sum((line) => line.quantity * line.listPriceCents),
    discountCents: sum((line) => line.discountCents),
    totalCents: sum((line) => line.totalCents),
  };
}
