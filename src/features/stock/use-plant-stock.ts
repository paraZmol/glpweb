import { listPlantStock, listStockMovements } from '../../data/plant-stock-repo';
import type { StockMovement } from '../../domain/stock/movement';
import type { PlantStock } from '../../domain/stock/plant-stock';
import { type ReloadableResource, useAsyncResource } from '../../lib/use-async-resource';
import { useRefreshOnReturn } from '../../lib/use-refresh-on-return';

// Owner and dispatcher only (PLAN §11, 2026-10-16); the driver gets `PermissionDeniedError`.
// Not live: read when the screen opens and each time the person comes back to it; call
// `reload()` after a write. Pass null while the distributor is not known.

/**
 * The plant stock, one entry per product ever moved (a product without one holds zero:
 * `emptyPlantStock`). Cost per load: one read per entry (one when there is none) plus 1 by
 * the rules.
 */
export function usePlantStock(distributorId: string | null): ReloadableResource<PlantStock[]> {
  const stock = useAsyncResource(distributorId && `plantStock:${distributorId}`, () =>
    listPlantStock(distributorId ?? ''),
  );
  useRefreshOnReturn(stock.reload, distributorId !== null);
  return stock;
}

/**
 * The latest movements of the plant stock, newest first, of every product or of one. Cost per
 * load: one read per movement (up to 20) plus 1 by the rules.
 */
export function useStockMovements(
  distributorId: string | null,
  productId: string | null = null,
): ReloadableResource<StockMovement[]> {
  const key = distributorId && `stockMovements:${distributorId}:${productId ?? '*'}`;
  const movements = useAsyncResource(key, () =>
    listStockMovements(distributorId ?? '', productId ? { productId } : {}),
  );
  useRefreshOnReturn(movements.reload, distributorId !== null);
  return movements;
}
