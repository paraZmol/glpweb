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
 * the list price of one unit (the honest "before"), ONE price per unit for the whole line, the
 * discount of the line, what it costs and the promotion it took. A promotion that does not price
 * every unit alike splits the line: the units beyond a cap go at list price, and the free units
 * of "lleva X, paga Y" come as a line of their own at 0 (its paid units: a line at list price
 * that names the promotion). Every price is whole cents.
 */
export interface PricedLine extends OrderItem {
  listPriceCents: number;
  unitPriceCents: number;
  /** `quantity × (listPriceCents − unitPriceCents)`. */
  discountCents: number;
  /** `quantity × unitPriceCents`. */
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
  /** "Lleva X, paga Y": the discount is made of free units. */
  givesFreeUnits: boolean;
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
    if (better) {
      const givesFreeUnits = promotion.deal.type === 'buyXPayY';
      best = { ...discount, promotionId: promotion.id, givesFreeUnits };
    }
  }
  return best;
}

function linesOf(item: Pending, choice: Choice | null): PricedLine[] {
  const list = item.listPriceCents;
  const line = (quantity: number, unitPriceCents: number, promotionId: string | null) => ({
    productId: item.productId,
    saleMode: item.saleMode,
    quantity,
    listPriceCents: list,
    unitPriceCents,
    discountCents: quantity * (list - unitPriceCents),
    totalCents: quantity * unitPriceCents,
    promotionId,
  });
  if (choice === null) return [line(item.quantity, list, null)];
  const id = choice.promotionId;
  const promoted = choice.givesFreeUnits
    ? [
        line(choice.units - choice.discountCents / list, list, id),
        line(choice.discountCents / list, 0, id),
      ]
    : [line(choice.units, list - choice.discountCents / choice.units, id)];
  const rest = item.quantity - choice.units;
  return rest > 0 ? [...promoted, line(rest, list, null)] : promoted;
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

/** What the orders domain injects to price the lines of an order (phase 4). */
export interface PricingInput {
  lines: readonly OrderItem[];
  products: readonly PricedProduct[];
  at: Date;
}

export type OrderPricer = (input: PricingInput) => PricedLine[];

/**
 * `priceOrder` as the orders domain takes it: the promotions of the distributor bound, the lines
 * of the order, its products and the time of the order in. Same errors as `priceOrder`.
 */
export function orderPricerWith(promotions: readonly Promotion[]): OrderPricer {
  return ({ lines, products, at }) => priceOrder(lines, products, promotions, at).lines;
}
