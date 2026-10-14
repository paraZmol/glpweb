import { toast } from 'sonner';
import { CatalogEmpty, CatalogList, CatalogListSkeleton } from '@/components/catalog/catalog-list';
import { Panel } from '@/components/layout/page-header';
import { MAX_PRODUCTS } from '@/domain/catalog/constants';
import type { Product } from '@/domain/catalog/product';
import { useOnlineStatus } from '@/lib/use-online-status';
import { cn } from '@/lib/utils';
import { AddProductButton } from './catalog-header';
import { ProductFormPanel } from './product-form-panel';
import { useCatalogChanges } from './use-catalog-changes';

/** What the right-hand panel (the whole screen, on a phone) is doing. */
export type Editing = { product: Product | null } | null;

type CatalogBoardProps = {
  distributorId: string;
  products: readonly Product[] | null;
  /** Loading again after a change: the old list stays, its controls wait. */
  isRefreshing: boolean;
  /** Only the owner of a writable distributor gets controls. */
  canEdit: boolean;
  editing: Editing;
  onEdit: (editing: Editing) => void;
  reload: () => void;
};

function Counts({ products }: { products: readonly Product[] }) {
  const onSale = products.filter((product) => product.active).length;
  return (
    <p className="text-sm font-semibold text-muted-foreground tabular-nums">
      {onSale} a la venta · {products.length - onSale} fuera de venta ·{' '}
      <span className="whitespace-nowrap">
        {products.length} de {MAX_PRODUCTS}
      </span>
    </p>
  );
}

/**
 * The catalogue and, for its owner, the form beside it (PLAN 3.1). Desktop: the list keeps the
 * width of the screen, and while a product is edited it narrows to its four columns, with the
 * form on the right. Phone: the form takes the place of the list.
 */
export function CatalogBoard(props: CatalogBoardProps) {
  const { distributorId, products, isRefreshing, canEdit, editing, onEdit, reload } = props;
  const isOnline = useOnlineStatus();
  const changes = useCatalogChanges({ distributorId, products, reload });
  const isLocked = changes.isBusy || isRefreshing || !isOnline;
  const showsControls = canEdit && editing === null;

  const saved = (message: string) => {
    toast.success(message);
    onEdit(null);
    reload();
  };

  const listOf = (items: readonly Product[]) =>
    items.length === 0 ? (
      <CatalogEmpty
        title={canEdit ? 'Todavía no cargas ningún balón.' : 'Todavía no hay productos.'}
        description={
          canEdit
            ? 'Añade el primero con su marca, su peso y el precio de la recarga. Tus clientes lo ven en tu página, en el orden que elijas.'
            : 'Los productos y sus precios los carga quien es titular de la distribuidora.'
        }
        action={canEdit && <AddProductButton onAdd={() => onEdit({ product: null })} isFirst />}
      />
    ) : (
      <CatalogList
        products={items}
        controls={
          showsControls
            ? {
                busyOf: changes.busyOf,
                isLocked,
                onEdit: (product) => onEdit({ product }),
                onMove: (product, step) => void changes.move(product, step),
                onToggleSale: (product) => void changes.toggleSale(product),
              }
            : undefined
        }
      />
    );

  return (
    <div
      className={cn(
        'grid grid-cols-[minmax(0,1fr)] items-start gap-4',
        editing && 'lg:grid-cols-[minmax(0,1fr)_26rem]',
      )}
    >
      <Panel dense className={cn(editing && 'max-lg:hidden')}>
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="text-lg font-bold">Productos</h2>
          {products && products.length > 0 && <Counts products={products} />}
        </div>
        {products ? listOf(products) : <CatalogListSkeleton />}
        <p aria-live="polite" className="sr-only">
          {changes.announcement}
        </p>
      </Panel>
      {editing && (
        <Panel dense>
          <ProductFormPanel
            key={editing.product?.id ?? 'new'}
            distributorId={distributorId}
            product={editing.product}
            onSaved={saved}
            onCancel={() => onEdit(null)}
          />
        </Panel>
      )}
    </div>
  );
}
