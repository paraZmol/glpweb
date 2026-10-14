import type { ReactNode } from 'react';
import { GasCylinder } from '@/components/brand/gas-cylinder';
import { Bone, LoadingRegion } from '@/components/common/skeleton';
import { EmptyState } from '@/components/common/state-views';
import { Stagger } from '@/components/motion/stagger';
import type { Product } from '@/domain/catalog/product';
import { CatalogRow } from './catalog-row';
import { CatalogRowActions, type RowBusy } from './catalog-row-actions';

const EMPTY_CYLINDER_PX = 72;
const SKELETON_ROWS = 4;

/** Desktop column titles, aligned with the columns of `CatalogRow`. */
function ColumnTitles({ hasActions }: { hasActions: boolean }) {
  return (
    <div
      aria-hidden="true"
      className="hidden grid-cols-[3.5rem_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_auto] gap-x-4 border-b pb-2 text-[0.8125rem] font-bold text-muted-foreground lg:grid"
    >
      <span />
      <span>Producto</span>
      <span>Recarga</span>
      <span>Balón completo</span>
      {hasActions && <span className="w-96" />}
    </div>
  );
}

/** What the owner can do on each row (PLAN 3.1). */
export interface CatalogControls {
  busyOf: (product: Product) => RowBusy;
  /** Something is running or there is no connection: nothing can be pressed. */
  isLocked: boolean;
  onEdit: (product: Product) => void;
  onMove: (product: Product, step: -1 | 1) => void;
  onToggleSale: (product: Product) => void;
}

type CatalogListProps = {
  products: readonly Product[];
  /** The owner's controls; absent for whoever only reads. */
  controls?: CatalogControls;
};

/** The catalogue in the order the distributor chose (PLAN 3.1), withdrawn products included. */
export function CatalogList({ products, controls }: CatalogListProps) {
  return (
    <div>
      <ColumnTitles hasActions={controls !== undefined} />
      <Stagger as="ul" className="flex flex-col divide-y" itemClassName="list-none">
        {products.map((product, index) => (
          <CatalogRow
            key={product.id}
            product={product}
            actions={
              controls && (
                <CatalogRowActions
                  product={product}
                  index={index}
                  total={products.length}
                  busy={controls.busyOf(product)}
                  isLocked={controls.isLocked}
                  onEdit={() => controls.onEdit(product)}
                  onMove={(step) => controls.onMove(product, step)}
                  onToggleSale={() => controls.onToggleSale(product)}
                />
              )
            }
          />
        ))}
      </Stagger>
    </div>
  );
}

/** The same rows while the catalogue loads, so nothing jumps when it arrives. */
export function CatalogListSkeleton() {
  return (
    <LoadingRegion label="Cargando el catálogo" className="flex flex-col divide-y">
      {Array.from({ length: SKELETON_ROWS }, (_, index) => (
        <div key={index} className="flex items-center gap-4 py-4">
          <Bone className="h-16 w-16 shrink-0 rounded-lg lg:h-14 lg:w-14" />
          <div className="flex flex-1 flex-col gap-2">
            <Bone className="h-5 w-48 max-w-full" />
            <Bone className="h-6 w-24 rounded-full" />
          </div>
          <Bone className="hidden h-10 w-56 rounded-full lg:block" />
        </div>
      ))}
    </LoadingRegion>
  );
}

type CatalogEmptyProps = { title: string; description: ReactNode; action?: ReactNode };

/** No product yet: a one-colour cylinder, what it means and, for the owner, the way out. */
export function CatalogEmpty({ title, description, action }: CatalogEmptyProps) {
  return (
    <EmptyState
      symbol={<GasCylinder weightKg={10} tone="mono" height={EMPTY_CYLINDER_PX} />}
      title={title}
      description={description}
      action={action}
    />
  );
}
