import { Bone, LoadingRegion } from '@/components/common/skeleton';
import { type Product, productTitle } from '@/domain/catalog/product';
import type { StockMovement } from '@/domain/stock/movement';
import { DEFAULT_TIMEZONE } from '@/domain/tenancy/constants';
import { ADJUSTMENT_REASON_LABELS } from '@/features/stock/stock-messages';
import { formatDateTime } from '@/lib/format-date';

const SKELETON_ROWS = 3;
const MINUS = '−';

/** "+3 llenos", "−1 vacío"; nothing for a side that did not move. */
function deltaText(delta: number, one: string, many: string): string | null {
  if (delta === 0) return null;
  const sign = delta > 0 ? '+' : MINUS;
  return `${sign}${Math.abs(delta)} ${Math.abs(delta) === 1 ? one : many}`;
}

/** "+3 llenos · −1 vacío" */
export function changeText({ fullDelta, emptyDelta }: { fullDelta: number; emptyDelta: number }) {
  return [deltaText(fullDelta, 'lleno', 'llenos'), deltaText(emptyDelta, 'vacío', 'vacíos')]
    .filter(Boolean)
    .join(' · ');
}

function MovementRow({ movement, product }: { movement: StockMovement; product?: Product }) {
  return (
    <article className="flex flex-col gap-1 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <h3 className="font-heading text-base font-bold tabular-nums">{changeText(movement)}</h3>
        <time
          dateTime={movement.createdAt.toISOString()}
          className="text-[0.8125rem] font-semibold text-muted-foreground tabular-nums"
        >
          {formatDateTime(movement.createdAt, DEFAULT_TIMEZONE)}
        </time>
      </div>
      <p className="text-[0.9375rem] font-semibold">
        {product ? productTitle(product) : 'Producto retirado'} ·{' '}
        {ADJUSTMENT_REASON_LABELS[movement.reason]}
      </p>
      {movement.note && <p className="text-[0.9375rem] wrap-anywhere">“{movement.note}”</p>}
      <p className="text-[0.8125rem] text-muted-foreground">
        Quedaron <span className="tabular-nums">{movement.fullAfter}</span>{' '}
        {movement.fullAfter === 1 ? 'lleno' : 'llenos'} y{' '}
        <span className="tabular-nums">{movement.emptyAfter}</span>{' '}
        {movement.emptyAfter === 1 ? 'vacío' : 'vacíos'} · Lo hizo{' '}
        <span className="font-semibold wrap-anywhere">{movement.authorName}</span>
      </p>
    </article>
  );
}

type MovementListProps = {
  movements: readonly StockMovement[];
  products: readonly Product[];
};

/** The history of the plant stock, newest first: who, when, how much and why (PLAN 3.4). */
export function MovementList({ movements, products }: MovementListProps) {
  return (
    <ul className="flex flex-col divide-y">
      {movements.map((movement) => (
        <li key={movement.id}>
          <MovementRow
            movement={movement}
            product={products.find((product) => product.id === movement.productId)}
          />
        </li>
      ))}
    </ul>
  );
}

export function MovementListSkeleton() {
  return (
    <LoadingRegion label="Cargando la bitácora" className="flex flex-col divide-y">
      {Array.from({ length: SKELETON_ROWS }, (_, index) => (
        <div key={index} className="flex flex-col gap-2 py-3">
          <Bone className="h-5 w-40" />
          <Bone className="h-4 w-64 max-w-full" />
          <Bone className="h-3.5 w-52 max-w-full" />
        </div>
      ))}
    </LoadingRegion>
  );
}
