import type { Product } from '../catalog/product';

/**
 * The products whose price lock must move to `endsAt` for a promotion ending then to apply to
 * them (PLAN §11, 2026-10-16): those of `productIds` whose `promotedUntil` falls short. A lock is
 * never moved earlier: the rules refuse that while it runs.
 */
export function locksToRaise(
  products: readonly Pick<Product, 'id' | 'promotedUntil'>[],
  productIds: readonly string[],
  endsAt: Date,
): string[] {
  return products
    .filter((product) => productIds.includes(product.id))
    .filter((product) => (product.promotedUntil?.getTime() ?? 0) < endsAt.getTime())
    .map((product) => product.id);
}
