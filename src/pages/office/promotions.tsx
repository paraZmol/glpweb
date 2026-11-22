import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/common/button';
import { InlineAlert } from '@/components/common/inline-alert';
import { Bone, LoadingRegion } from '@/components/common/skeleton';
import { ErrorState } from '@/components/common/state-views';
import { PageHeader } from '@/components/layout/page-header';
import { MAX_PROMOTIONS } from '@/domain/pricing/constants';
import { PromotionsFullError } from '@/domain/pricing/errors';
import { canManagePromotions } from '@/domain/pricing/permissions';
import { freePromotionSlot } from '@/domain/pricing/promotion';
import { OfflineError } from '@/domain/tenancy/errors';
import { useAccount } from '@/features/account/account-context';
import { useCatalog } from '@/features/catalog/use-catalog';
import { nowAfter } from '@/features/promotions/promotion-clock';
import { describePromotionError } from '@/features/promotions/promotion-messages';
import { usePromotions } from '@/features/promotions/use-promotions';
import { ICON_STROKE } from '@/lib/icons';
import { usePageTitle } from '@/lib/page-title';
import { useLastReady } from '@/lib/use-last-ready';
import { useOnlineStatus } from '@/lib/use-online-status';
import { groupPromotions } from './promotion-list';
import { PromotionsBoard } from './promotions-board';
import {
  NO_PRODUCTS,
  NOT_PUBLIC_YET,
  PLAN_READ_ONLY,
  PROMOTIONS_STAFF_READS,
} from './promotions-copy';
import { isSuspended, SuspendedNotice } from './read-only-notice';
import { usePromotionMode } from './use-promotion-mode';

function PromotionsPageSkeleton() {
  return (
    <LoadingRegion label="Cargando las promociones" className="flex flex-col gap-6">
      <Bone className="h-8 w-56" />
      <Bone className="h-80 rounded-lg" />
    </LoadingRegion>
  );
}

/**
 * `/central/promociones` (PLAN 3.5): the promotions of the distributor, and "Añadir promoción"
 * for the owner and the dispatcher (§11, 2026-10-16). No countdowns nor invented urgency; every
 * limit is the domain's. A read-only distributor shows them without a single control.
 */
export function PromotionsPage() {
  usePageTitle('Promociones');
  const { current, session } = useAccount();
  const isOnline = useOnlineStatus();
  const distributorId = current.status === 'ready' ? current.distributor.id : null;
  const resource = usePromotions(distributorId);
  const catalog = useCatalog(distributorId);
  const { data: promotions, isRefreshing } = useLastReady(resource, distributorId);
  const products = useLastReady(catalog, distributorId).data;
  const [opened] = useState(() => new Date());
  const now = nowAfter(opened, promotions);
  const promotionMode = usePromotionMode(distributorId, promotions);
  if (current.status !== 'ready') return <PromotionsPageSkeleton />;

  const { distributor, membership, isWritable } = current;
  const manages = canManagePromotions(membership.role);
  const canEdit = manages && isWritable;
  const mode = canEdit ? promotionMode.mode : null;
  const { onMode } = promotionMode;
  const hasProducts = products?.some((product) => product.active) ?? false;
  const isFull = promotions !== null && freePromotionSlot(promotions, now) === null;
  const addButton = (
    <Button
      type="button"
      className="max-sm:w-full"
      onClick={() => onMode({ kind: 'add', repeat: null })}
    >
      <Plus aria-hidden="true" strokeWidth={ICON_STROKE} />
      Añadir promoción
    </Button>
  );
  const hasAlive = promotions !== null && groupPromotions(promotions, now).alive.length > 0;
  const canAdd =
    hasAlive &&
    canEdit &&
    mode === null &&
    promotions !== null &&
    products !== null &&
    hasProducts &&
    !isFull;
  const failed =
    resource.status === 'error' ? resource : catalog.status === 'error' ? catalog : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        dense
        title={manages ? 'Tus promociones.' : 'Promociones.'}
        lead="Rebajas con fecha de cierre y un máximo por pedido. El precio de antes es siempre el de tu lista, y nunca hay cuenta regresiva."
        aside={canAdd && addButton}
      />
      {!isWritable && (
        <InlineAlert tone="info">
          {isSuspended(distributor.status) ? <SuspendedNotice /> : PLAN_READ_ONLY}
        </InlineAlert>
      )}
      {!manages && <InlineAlert tone="info">{PROMOTIONS_STAFF_READS}</InlineAlert>}
      {manages && <InlineAlert tone="info">{NOT_PUBLIC_YET}</InlineAlert>}
      {canEdit && products !== null && !hasProducts && (
        <InlineAlert tone="info">{NO_PRODUCTS}</InlineAlert>
      )}
      {canEdit && isFull && (
        <InlineAlert tone="info">
          {describePromotionError(new PromotionsFullError(MAX_PROMOTIONS))}
        </InlineAlert>
      )}
      {failed && (!promotions || !products) ? (
        <ErrorState
          title={isOnline ? 'No pudimos cargar las promociones.' : 'Sin conexión.'}
          description={
            !isOnline || failed.error instanceof OfflineError
              ? 'Para ver tus promociones necesitas internet. Vuelve a intentar cuando regrese la señal.'
              : 'Algo falló de nuestro lado o en la conexión. Vuelve a intentar en un momento.'
          }
          onRetry={() => {
            resource.reload();
            catalog.reload();
          }}
          className="rounded-lg"
        />
      ) : (
        <PromotionsBoard
          distributor={distributor}
          uid={session.uid}
          promotions={promotions}
          products={products}
          isRefreshing={isRefreshing}
          now={now}
          canEdit={canEdit}
          mode={mode}
          onMode={onMode}
          addButton={hasProducts && !isFull ? addButton : null}
          reload={() => {
            resource.reload();
            catalog.reload();
          }}
        />
      )}
    </div>
  );
}
