import { Bone, LoadingRegion } from '@/components/common/skeleton';
import { ErrorState } from '@/components/common/state-views';
import { canEditCatalog } from '@/domain/catalog/permissions';
import { OfflineError } from '@/domain/tenancy/errors';
import { useAccount } from '@/features/account/account-context';
import { useCatalog } from '@/features/catalog/use-catalog';
import { usePageTitle } from '@/lib/page-title';
import { useLastReady } from '@/lib/use-last-ready';
import { useOnlineStatus } from '@/lib/use-online-status';
import { CatalogBoard } from './catalog-board';
import { CatalogHeader } from './catalog-header';
import { useProductFormEntry } from './use-product-form-entry';

function CatalogPageSkeleton() {
  return (
    <LoadingRegion label="Cargando el catálogo" className="flex flex-col gap-6">
      <Bone className="h-8 w-56" />
      <Bone className="h-96 rounded-lg" />
    </LoadingRegion>
  );
}

/**
 * `/central/catalogo` (PLAN 3.1): the products of the distributor and their prices. Its owner
 * and its dispatcher (PLAN §11, 2026-10-15) add, edit, order and take products off sale; a
 * read-only distributor (suspended, payment pending, trial over) shows it without a single
 * control.
 */
export function CatalogPage() {
  usePageTitle('Catálogo');
  const { current } = useAccount();
  const isOnline = useOnlineStatus();
  const distributorId = current.status === 'ready' ? current.distributor.id : null;
  const catalog = useCatalog(distributorId);
  const { data: products, isRefreshing } = useLastReady(catalog, distributorId);
  // A step of the history, with its distributor: "back" closes it, switching closes it.
  const { editing, setEditing } = useProductFormEntry(distributorId, products);
  if (current.status !== 'ready') return <CatalogPageSkeleton />;

  const { distributor, membership, isWritable } = current;
  const managesCatalog = canEditCatalog(membership.role);
  const canEdit = managesCatalog && isWritable;

  return (
    <div className="flex flex-col gap-6">
      <CatalogHeader
        distributor={distributor}
        managesCatalog={managesCatalog}
        isWritable={isWritable}
        total={products?.length ?? null}
        isEditing={editing !== null}
        onAdd={() => setEditing({ product: null })}
      />
      {catalog.status === 'error' ? (
        <ErrorState
          title={isOnline ? 'No pudimos cargar el catálogo.' : 'Sin conexión.'}
          description={
            !isOnline || catalog.error instanceof OfflineError
              ? 'Para ver el catálogo necesitas internet. Vuelve a intentar cuando regrese la señal.'
              : 'Algo falló de nuestro lado o en la conexión. Vuelve a intentar en un momento.'
          }
          onRetry={catalog.reload}
          className="rounded-lg"
        />
      ) : (
        <CatalogBoard
          distributorId={distributor.id}
          products={products}
          isRefreshing={isRefreshing}
          canEdit={canEdit}
          editing={canEdit ? editing : null}
          onEdit={setEditing}
          reload={catalog.reload}
        />
      )}
    </div>
  );
}
