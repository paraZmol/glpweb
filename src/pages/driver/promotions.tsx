import { useState } from 'react';
import { Bone, LoadingRegion } from '@/components/common/skeleton';
import { ErrorState } from '@/components/common/state-views';
import { PageHeader } from '@/components/layout/page-header';
import { PromotionCard, PromotionListSkeleton } from '@/components/promotions/promotion-card';
import { promotionStateOf } from '@/domain/pricing/promotion';
import { useAccount } from '@/features/account/account-context';
import { useCatalog } from '@/features/catalog/use-catalog';
import { nowAfter } from '@/features/promotions/promotion-clock';
import { usePromotions } from '@/features/promotions/use-promotions';
import { usePageTitle } from '@/lib/page-title';
import { useLastReady } from '@/lib/use-last-ready';
import { DriverReadOnlyNotice } from './read-only-notice';

const FRAME = 'max-w-4xl rounded-lg border-2 border-foreground bg-card px-5 py-2 lg:px-7';
/** What a driver may be asked about at the door: what applies now and what is about to. */
const SHOWN_STATES = ['live', 'soldOut', 'scheduled'] as const;

/**
 * `/reparto/promociones` (PLAN 3.5): the promotions that apply now or are scheduled, read-only,
 * so the driver can answer at the door. Drafts and ended ones are the office's business.
 */
export function DriverPromotionsPage() {
  usePageTitle('Promociones');
  const { current } = useAccount();
  const distributorId = current.status === 'ready' ? current.distributor.id : null;
  const resource = usePromotions(distributorId);
  const catalog = useCatalog(distributorId);
  const { data: promotions } = useLastReady(resource, distributorId);
  const products = useLastReady(catalog, distributorId).data;
  const [opened] = useState(() => new Date());
  const now = nowAfter(opened, promotions);
  if (current.status !== 'ready') {
    return (
      <LoadingRegion label="Cargando las promociones" className="flex flex-col gap-6">
        <Bone className="h-10 w-3/4 max-w-sm" />
        <Bone className="h-80 max-w-4xl rounded-lg" />
      </LoadingRegion>
    );
  }
  const shown = promotions?.filter((promotion) =>
    (SHOWN_STATES as readonly string[]).includes(promotionStateOf(promotion, now)),
  );
  const failed = resource.status === 'error' || catalog.status === 'error';

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Promociones."
        lead={`Las de ${current.distributor.name} que valen hoy o ya están programadas, con sus condiciones. Las crean el titular y la central.`}
      />
      {!current.isWritable && <DriverReadOnlyNotice distributor={current.distributor} />}
      {failed && (!shown || !products) ? (
        <ErrorState
          title="No pudimos cargar las promociones."
          description="Revisa la señal y vuelve a intentar."
          onRetry={() => {
            resource.reload();
            catalog.reload();
          }}
          className="max-w-4xl rounded-lg"
        />
      ) : (
        <section aria-label="Promociones" className={FRAME}>
          {!shown || !products ? (
            <PromotionListSkeleton />
          ) : shown.length === 0 ? (
            <p className="py-5 text-lg font-semibold">Hoy no hay promociones.</p>
          ) : (
            <ul className="flex flex-col divide-y">
              {shown.map((promotion) => (
                <li key={promotion.id}>
                  <PromotionCard
                    promotion={promotion}
                    products={products}
                    now={now}
                    currency={current.distributor.currency}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
