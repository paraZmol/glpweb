import { toast } from 'sonner';
import { CatalogEmpty } from '@/components/catalog/catalog-list';
import { ButtonLink } from '@/components/common/button';
import { Panel } from '@/components/layout/page-header';
import { type StockLine, StockList, StockListSkeleton } from '@/components/stock/stock-list';
import type { Product } from '@/domain/catalog/product';
import type { StockMovement } from '@/domain/stock/movement';
import { emptyPlantStock, type PlantStock } from '@/domain/stock/plant-stock';
import { useOnlineStatus } from '@/lib/use-online-status';
import { ROUTES } from '@/lib/routes';
import { cn } from '@/lib/utils';
import { StockAdjustPanel } from './stock-adjust-panel';
import { StockHistory } from './stock-history';

/** Each product of the catalogue with its stock; a product never moved holds zero. */
export function stockLinesOf(
  products: readonly Product[],
  stock: readonly PlantStock[],
): StockLine[] {
  return products.map((product) => ({
    product,
    stock: stock.find((entry) => entry.productId === product.id) ?? emptyPlantStock(product.id),
  }));
}

function Totals({ lines }: { lines: readonly StockLine[] }) {
  const sum = (pick: (line: StockLine) => number) =>
    lines.reduce((total, line) => total + pick(line), 0);
  return (
    <p className="text-sm font-semibold text-muted-foreground tabular-nums">
      En total: {sum((line) => line.stock.full)} llenos · {sum((line) => line.stock.empty)} vacíos
    </p>
  );
}

type StockBoardProps = {
  distributorId: string;
  authorUid: string;
  lines: readonly StockLine[] | null;
  movements: { data: readonly StockMovement[] | null; hasFailed: boolean; reload: () => void };
  canAdjust: boolean;
  isRefreshing: boolean;
  /** The product being adjusted, if any. */
  adjusting: string | null;
  onAdjust: (productId: string | null) => void;
  historyOf: string | null;
  onHistoryOf: (productId: string | null) => void;
  reload: () => void;
};

/**
 * The plant stock and its history (PLAN 3.4). Desktop: the stock on the left; on the right the
 * adjustment that is open and, under it, the history of that product. Phone: the adjustment
 * takes the whole screen; otherwise the stock comes first and the history under it.
 */
export function StockBoard(props: StockBoardProps) {
  const { distributorId, authorUid, lines, movements, canAdjust, isRefreshing } = props;
  const { adjusting, onAdjust, historyOf, onHistoryOf, reload } = props;
  const isOnline = useOnlineStatus();
  const line = lines?.find((entry) => entry.product.id === adjusting) ?? null;
  const products = lines?.map((entry) => entry.product) ?? [];

  const saved = (message: string) => {
    toast.success(message);
    onAdjust(null);
    reload();
    movements.reload();
  };

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-[minmax(0,1fr)_26rem]">
      <Panel dense className={cn(line && 'max-lg:hidden')}>
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="text-lg font-bold">Por producto</h2>
          {lines && lines.length > 0 && <Totals lines={lines} />}
        </div>
        {!lines && <StockListSkeleton />}
        {lines?.length === 0 && (
          <CatalogEmpty
            title="Todavía no hay productos."
            description="El stock se lleva por cada producto del catálogo. Carga el primero y vuelve aquí."
            action={
              <ButtonLink to={ROUTES.officeCatalog} variant="line">
                Ir al catálogo
              </ButtonLink>
            }
          />
        )}
        {lines && lines.length > 0 && (
          <StockList
            lines={lines}
            isLocked={isRefreshing || !isOnline}
            onAdjust={canAdjust && !line ? (entry) => onAdjust(entry.product.id) : undefined}
          />
        )}
      </Panel>
      <div className="flex flex-col gap-4">
        {line && (
          <Panel dense>
            <StockAdjustPanel
              key={line.product.id}
              distributorId={distributorId}
              authorUid={authorUid}
              line={line}
              onSaved={saved}
              onCancel={() => onAdjust(null)}
            />
          </Panel>
        )}
        {lines && lines.length > 0 && (
          <div className={cn(line && 'max-lg:hidden')}>
            <StockHistory
              movements={movements.data}
              hasFailed={movements.hasFailed}
              onRetry={movements.reload}
              products={products}
              productId={historyOf}
              onProductChange={onHistoryOf}
            />
          </div>
        )}
      </div>
    </div>
  );
}
