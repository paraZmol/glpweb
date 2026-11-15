import { useRef } from 'react';
import { CHIP_CLASS } from '@/components/catalog/weight-choice';
import { ErrorState } from '@/components/common/state-views';
import { Panel } from '@/components/layout/page-header';
import { MovementList, MovementListSkeleton } from '@/components/stock/movement-list';
import type { Product } from '@/domain/catalog/product';
import { MOVEMENTS_QUERY_LIMIT } from '@/domain/stock/constants';
import type { StockMovement } from '@/domain/stock/movement';
import { useOverflowEnd } from '@/lib/use-overflow-end';
import { cn } from '@/lib/utils';

// The chips are toggles that filter (aria-pressed), drawn like the chosen chip of a choice.
const PRESSED =
  'aria-pressed:bg-foreground aria-pressed:text-background aria-pressed:inset-ring-foreground';

type StockHistoryProps = {
  /** The movements on screen: null while they first load. */
  movements: readonly StockMovement[] | null;
  hasFailed: boolean;
  onRetry: () => void;
  products: readonly Product[];
  /** The product whose history is shown; null for all of them. */
  productId: string | null;
  onProductChange: (productId: string | null) => void;
};

/**
 * The history of the plant stock (PLAN 3.4): the latest movements, newest first, of every
 * product or of one. Nothing in it can be edited or deleted; it says who, when, how much and why.
 */
export function StockHistory(props: StockHistoryProps) {
  const { movements: data, hasFailed, onRetry, products, productId, onProductChange } = props;
  const rowRef = useRef<HTMLDivElement>(null);
  const hasMore = useOverflowEnd(rowRef);
  const chip = (id: string | null, label: string) => (
    <button
      key={id ?? 'all'}
      type="button"
      aria-pressed={productId === id}
      onClick={() => onProductChange(id)}
      className={cn(CHIP_CLASS, PRESSED, 'shrink-0 whitespace-nowrap')}
    >
      {label}
    </button>
  );

  return (
    <Panel dense>
      <h2 className="text-lg font-bold">Bitácora</h2>
      <p className="mt-1 text-muted-foreground">
        Los últimos {MOVEMENTS_QUERY_LIMIT} movimientos. No se editan ni se borran.
      </p>
      <div className="relative -mx-1 mt-3">
        <div
          ref={rowRef}
          role="group"
          aria-label="Producto de la bitácora"
          className="flex gap-2 overflow-x-auto px-1 py-1"
        >
          {chip(null, 'Todos')}
          {products.map((product) => chip(product.id, `${product.weightKg} kg ${product.brand}`))}
        </div>
        {/* More chips past the edge: it fades out instead of cutting one in half. */}
        <div
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute inset-y-0 right-0 w-12 bg-linear-to-l from-card to-transparent transition-opacity motion-fast',
            hasMore ? 'opacity-100' : 'opacity-0',
          )}
        />
      </div>
      {hasFailed && !data ? (
        <ErrorState
          title="No pudimos cargar la bitácora."
          description="Puede ser la conexión. Vuelve a intentar en un momento."
          onRetry={onRetry}
          className="mt-3 rounded-lg p-0 shadow-none"
        />
      ) : !data ? (
        <MovementListSkeleton />
      ) : data.length === 0 ? (
        <p className="mt-4 font-semibold">Todavía no hay movimientos.</p>
      ) : (
        <MovementList movements={data} products={products} />
      )}
    </Panel>
  );
}
