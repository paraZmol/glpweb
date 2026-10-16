import type { Product } from '../catalog/product';
import type { LineRequest, OrderLine } from './lines';
import { lineKey, listPriceOf } from './lines';

export interface RepeatedOrder {
  /** What to ask for again, priced as of today when the new order is created. */
  lines: LineRequest[];
  /** Lines of the old order the distributor no longer sells that way (removed, or no full). */
  dropped: Pick<OrderLine, 'productId' | 'saleMode' | 'brand' | 'name' | 'weightKg'>[];
}

function isStillSold(line: OrderLine, products: readonly Product[]): boolean {
  const product = products.find((p) => p.id === line.productId);
  return product?.active === true && listPriceOf(product, line.saleMode) !== null;
}

/**
 * "Pedir lo mismo" (PLAN 4.6, CU-10 of GLP-DEV): copies what was ordered, never what it cost.
 * Lines of the same product and sale mode come together again (a free unit had a line of its
 * own); whatever the catalogue no longer sells that way is dropped and reported once, so the
 * screen can say so. The new order goes through the pricer like any other.
 */
export function repeatOrder(
  lines: readonly OrderLine[],
  products: readonly Product[],
): RepeatedOrder {
  const merged = new Map<string, LineRequest>();
  const dropped = new Map<string, RepeatedOrder['dropped'][number]>();
  for (const line of lines) {
    const key = lineKey(line);
    const { productId, saleMode, quantity, brand, name, weightKg } = line;
    if (isStillSold(line, products)) {
      merged.set(key, {
        productId,
        saleMode,
        quantity: (merged.get(key)?.quantity ?? 0) + quantity,
      });
    } else if (!dropped.has(key)) {
      dropped.set(key, { productId, saleMode, brand, name, weightKg });
    }
  }
  return { lines: [...merged.values()], dropped: [...dropped.values()] };
}
