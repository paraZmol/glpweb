import { useState } from 'react';
import { Bone, LoadingRegion } from '@/components/common/skeleton';
import { ErrorState } from '@/components/common/state-views';
import { OfflineError } from '@/domain/tenancy/errors';
import { useAccount } from '@/features/account/account-context';
import { useCatalog } from '@/features/catalog/use-catalog';
import { usePageTitle } from '@/lib/page-title';
import { useLastReady } from '@/lib/use-last-ready';
import { useOnlineStatus } from '@/lib/use-online-status';
import { CatalogBoard, type Editing } from './catalog-board';
import { CatalogHeader } from './catalog-header';

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
 * adds, edits, orders and takes products off sale; the dispatcher reads it as it is; a read-only
 * distributor (suspended, payment pending, trial over) shows it without a single control.
 */
export function CatalogPage() {
  usePageTitle('Catálogo');
  const { current } = useAccount();
  const isOnline = useOnlineStatus();
  const distributorId = current.status === 'ready' ? current.distributor.id : null;
  const catalog = useCatalog(distributorId);
  const { data: products, isRefreshing } = useLastReady(catalog, distributorId);
  // Remembered with its distributor: switching to another one closes the form.
  const [open, setOpen] = useState<{ distributorId: string | null; editing: Editing }>({
    distributorId: null,
    editing: null,
  });
  const editing = open.distributorId === distributorId ? open.editing : null;
  const setEditing = (next: Editing) => setOpen({ distributorId, editing: next });
  if (current.status !== 'ready') return <CatalogPageSkeleton />;

  const { distributor, membership, isWritable } = current;
  const isOwner = membership.role === 'owner';
  const canEdit = isOwner && isWritable;

  return (
    <div className="flex flex-col gap-6">
      <CatalogHeader
        distributor={distributor}
        isOwner={isOwner}
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
