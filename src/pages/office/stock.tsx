import { useState } from 'react';
import { InlineAlert } from '@/components/common/inline-alert';
import { Bone, LoadingRegion } from '@/components/common/skeleton';
import { ErrorState } from '@/components/common/state-views';
import { PageHeader } from '@/components/layout/page-header';
import { DeniedRedirect } from '@/components/layout/require-access';
import { canAdjustPlantStock, canReadPlantStock } from '@/domain/stock/permissions';
import { OfflineError } from '@/domain/tenancy/errors';
import { useAccount } from '@/features/account/account-context';
import { useCatalog } from '@/features/catalog/use-catalog';
import { usePlantStock, useStockMovements } from '@/features/stock/use-plant-stock';
import { usePageTitle } from '@/lib/page-title';
import { AREA_HOME } from '@/lib/routes';
import { useLastReady } from '@/lib/use-last-ready';
import { useOnlineStatus } from '@/lib/use-online-status';
import { isSuspended, SuspendedNotice } from './read-only-notice';
import { StockBoard, stockLinesOf } from './stock-board';
import { useFormEntry } from './use-form-entry';

const PLAN_READ_ONLY =
  'Tu distribuidora está en solo lectura: puedes ver el stock y la bitácora, pero no ajustarlos hasta regularizar el plan.';

function StockPageSkeleton() {
  return (
    <LoadingRegion label="Cargando el stock" className="flex flex-col gap-6">
      <Bone className="h-8 w-56" />
      <Bone className="h-96 rounded-lg" />
    </LoadingRegion>
  );
}

/** The product whose history is shown, per distributor. */
type HistoryFocus = { at: string; historyOf: string | null };

/**
 * `/central/stock` (PLAN 3.4): full and empty cylinders of each product at the plant, adjusted
 * with a reason, and the history of every change. The owner and the dispatcher read and adjust
 * it (§11, 2026-10-16); the driver never sees it (no link, no route in its area, and the rules
 * refuse the read). A read-only distributor shows it without a single control.
 */
export function PlantStockPage() {
  usePageTitle('Stock de planta');
  const { current, session } = useAccount();
  const isOnline = useOnlineStatus();
  const distributorId = current.status === 'ready' ? current.distributor.id : null;
  const [focus, setFocus] = useState<HistoryFocus | null>(null);
  const historyOf = focus?.at === distributorId ? focus.historyOf : null;
  // The adjustment is a step of the history: "back" closes it and stays on the stock.
  const entry = useFormEntry('stockAdjust', distributorId);
  const adjusting = typeof entry.value === 'string' ? entry.value : null;
  const catalog = useCatalog(distributorId);
  const stock = usePlantStock(distributorId);
  const movements = useStockMovements(distributorId, historyOf);
  const products = useLastReady(catalog, distributorId).data;
  const { data: entries, isRefreshing } = useLastReady(stock, distributorId);
  const history = useLastReady(movements, `${distributorId}:${historyOf ?? '*'}`).data;
  if (current.status !== 'ready') return <StockPageSkeleton />;
  const { distributor, membership, isWritable } = current;
  if (!canReadPlantStock(membership.role)) return <DeniedRedirect to={AREA_HOME.office} />;

  const canAdjust = canAdjustPlantStock(membership.role) && isWritable;
  const failed = catalog.status === 'error' ? catalog : stock.status === 'error' ? stock : null;
  const lines = products && entries ? stockLinesOf(products, entries) : null;
  const showHistoryOf = (productId: string | null) =>
    setFocus({ at: distributor.id, historyOf: productId });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        dense
        title="Stock de planta."
        lead="Balones llenos y vacíos de cada producto en tu planta. Cada ajuste dice por qué y queda en la bitácora con quién lo hizo."
      />
      {!isWritable && (
        <InlineAlert tone="info">
          {isSuspended(distributor.status) ? <SuspendedNotice /> : PLAN_READ_ONLY}
        </InlineAlert>
      )}
      {failed && !lines ? (
        <ErrorState
          title={isOnline ? 'No pudimos cargar el stock.' : 'Sin conexión.'}
          description={
            !isOnline || failed.error instanceof OfflineError
              ? 'Para ver el stock necesitas internet. Vuelve a intentar cuando regrese la señal.'
              : 'Algo falló de nuestro lado o en la conexión. Vuelve a intentar en un momento.'
          }
          onRetry={() => {
            catalog.reload();
            stock.reload();
          }}
          className="rounded-lg"
        />
      ) : (
        <StockBoard
          distributorId={distributor.id}
          authorUid={session.uid}
          lines={lines}
          movements={{
            data: history,
            hasFailed: movements.status === 'error',
            reload: movements.reload,
          }}
          canAdjust={canAdjust}
          isRefreshing={isRefreshing}
          adjusting={canAdjust ? adjusting : null}
          onAdjust={(productId) => {
            if (productId === null) return entry.close();
            showHistoryOf(productId);
            return entry.open(productId);
          }}
          historyOf={historyOf}
          onHistoryOf={showHistoryOf}
          reload={stock.reload}
        />
      )}
    </div>
  );
}
