import { ArrowLeft } from 'lucide-react';
import { useParams } from 'react-router';
import { ButtonLink } from '@/components/common/button';
import { Bone, LoadingRegion } from '@/components/common/skeleton';
import { EmptyState, ErrorState } from '@/components/common/state-views';
import { PageHeader, Panel } from '@/components/layout/page-header';
import { useAccount } from '@/features/account/account-context';
import { useListingReview, usePendingListings } from '@/features/platform/use-pending-listings';
import { ICON_STROKE } from '@/lib/icons';
import { usePageTitle } from '@/lib/page-title';
import { ROUTES } from '@/lib/routes';
import { useIsDesktop } from '@/lib/use-media-query';
import { ListingReviewView } from './listing-review';
import { PendingList } from './pending-list';

function ReviewSkeleton() {
  return (
    <LoadingRegion label="Cargando la ficha" className="flex flex-col gap-4">
      <Bone className="h-12 w-72" />
      <div className="grid gap-4 xl:grid-cols-2">
        <Bone className="h-80 rounded-lg" />
        <Bone className="h-80 rounded-lg" />
      </div>
    </LoadingRegion>
  );
}

type ReviewPaneProps = {
  distributorId: string | null;
  /** After a decision the list changes too. */
  onDecided: () => void;
};

function ReviewPane({ distributorId, onDecided }: ReviewPaneProps) {
  const { session } = useAccount();
  const review = useListingReview(distributorId);

  if (distributorId === null) {
    return (
      <EmptyState
        title="Elige un alta de la lista."
        description="Vas a ver su ficha pública, los datos que declaró y las decisiones posibles."
      />
    );
  }
  if (review.status === 'error') {
    return (
      <ErrorState
        className="shadow-none"
        title="No pudimos cargar esta ficha."
        description="Puede ser la conexión. Vuelve a intentar en un momento."
        onRetry={review.reload}
      />
    );
  }
  if (review.status !== 'ready') return <ReviewSkeleton />;
  if (review.data === null) {
    return (
      <EmptyState
        title="Esta distribuidora no existe."
        description="Puede que el identificador esté mal escrito. Vuelve a la lista."
      />
    );
  }
  const decided = () => {
    review.reload();
    onDecided();
  };
  return <ListingReviewView review={review.data} admin={session} onDecided={decided} />;
}

/**
 * `/plataforma` (PLAN 2.11): the listings that wait for the review of the platform and, for the
 * one that is open, everything needed to decide. Phone: the list, then the listing on its own
 * screen. Desktop: the list on the left and the listing beside it. Being here grants nothing:
 * every decision is checked again by the security rules.
 */
export function PlatformHomePage() {
  const { distributorId = null } = useParams();
  usePageTitle(distributorId ? 'Revisar un alta' : 'Altas pendientes');
  const isDesktop = useIsDesktop();
  const pending = usePendingListings();
  const showsList = isDesktop || distributorId === null;
  const showsReview = isDesktop || distributorId !== null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        dense
        title="Altas pendientes."
        lead="Distribuidoras que esperan la revisión de Hornilla antes de aparecer en el buscador."
        aside={
          showsList ? (
            <ButtonLink to={ROUTES.account} variant="line" size="sm">
              Revisar mi cuenta
            </ButtonLink>
          ) : (
            <ButtonLink to={ROUTES.platformHome} variant="quiet" size="sm">
              <ArrowLeft aria-hidden="true" strokeWidth={ICON_STROKE} />
              Volver a la lista
            </ButtonLink>
          )
        }
      />
      <div className="grid items-start gap-4 lg:grid-cols-[22rem_minmax(0,1fr)]">
        {showsList && (
          <Panel dense className="lg:max-h-[calc(100dvh-11rem)] lg:overflow-y-auto lg:p-4">
            <PendingList pending={pending} />
          </Panel>
        )}
        {showsReview && (
          <Panel dense>
            <ReviewPane
              key={distributorId}
              distributorId={distributorId}
              onDecided={pending.reload}
            />
          </Panel>
        )}
      </div>
    </div>
  );
}
