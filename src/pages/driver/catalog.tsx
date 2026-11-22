import { CatalogEmpty, CatalogList, CatalogListSkeleton } from '@/components/catalog/catalog-list';
import { Bone, LoadingRegion } from '@/components/common/skeleton';
import { ErrorState } from '@/components/common/state-views';
import { PageHeader } from '@/components/layout/page-header';
import { useAccount } from '@/features/account/account-context';
import { useCatalog } from '@/features/catalog/use-catalog';
import { usePageTitle } from '@/lib/page-title';
import { useLastReady } from '@/lib/use-last-ready';
import { DriverReadOnlyNotice } from './read-only-notice';

const FRAME = 'max-w-4xl rounded-lg border-2 border-foreground bg-card px-5 py-2 lg:px-7';

/**
 * `/reparto/catalogo` (PLAN 3.1): what the distributor sells and at what price, for the driver
 * to answer at the door. Read-only, like for the dispatcher; the words are the ones marketing
 * gives the street (§2.1): a refill means picking up the empty one.
 */
export function DriverCatalogPage() {
  usePageTitle('Catálogo');
  const { current } = useAccount();
  const distributorId = current.status === 'ready' ? current.distributor.id : null;
  const catalog = useCatalog(distributorId);
  // Read again on every return to the screen: the list on screen stays while it loads.
  const { data: products } = useLastReady(catalog, distributorId);
  if (current.status !== 'ready') {
    return (
      <LoadingRegion label="Cargando el catálogo" className="flex flex-col gap-6">
        <Bone className="h-10 w-3/4 max-w-sm" />
        <Bone className="h-96 max-w-4xl rounded-lg" />
      </LoadingRegion>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Catálogo y precios."
        lead={`Lo que vende ${current.distributor.name}. Recarga: recoges el balón vacío. Balón completo: no hay vacío que recoger.`}
      />
      {!current.isWritable && <DriverReadOnlyNotice distributor={current.distributor} />}
      {catalog.status === 'error' && !products ? (
        <ErrorState
          title="No pudimos cargar el catálogo."
          description="Revisa la señal y vuelve a intentar."
          onRetry={catalog.reload}
          className="max-w-4xl rounded-lg"
        />
      ) : (
        <section aria-label="Productos" className={FRAME}>
          {!products ? (
            <CatalogListSkeleton />
          ) : products.length === 0 ? (
            <div className="py-5">
              <CatalogEmpty
                title="Todavía no hay productos."
                description="Los cargan el titular o la central de la distribuidora."
              />
            </div>
          ) : (
            <CatalogList products={products} />
          )}
        </section>
      )}
    </div>
  );
}
