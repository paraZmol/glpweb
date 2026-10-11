import { ArrowLeft } from 'lucide-react';
import { useParams, useSearchParams } from 'react-router';
import { ButtonLink } from '@/components/common/button';
import { Bone, LoadingRegion } from '@/components/common/skeleton';
import { EmptyState, ErrorState } from '@/components/common/state-views';
import { PageHeader, Panel } from '@/components/layout/page-header';
import { useAccount } from '@/features/account/account-context';
import { useListingReview } from '@/features/platform/use-listing-review';
import { usePlatformDistributors } from '@/features/platform/use-platform-distributors';
import { ICON_STROKE } from '@/lib/icons';
import { usePageTitle } from '@/lib/page-title';
import { ROUTES } from '@/lib/routes';
import { useIsDesktop } from '@/lib/use-media-query';
import { DistributorList } from './distributor-list';
import { ListFilter } from './list-filter';
import { FILTER_COPY, filterOf, platformListPath } from './listing-labels';
import { ListingReviewView } from './listing-review';

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
        title="Elige una distribuidora de la lista."
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
 * `/plataforma` (PLAN 2.11): the distributors of the platform in three lists — the listings that
 * wait for its review (the one it opens on), the approved ones and the suspended ones — and, for
 * the one that is open, everything needed to decide. The list is chosen with `?estado=`. Phone:
 * the list, then the distributor on its own screen. Desktop: the list on the left and the
 * distributor beside it. Being here grants nothing: every decision is checked again by the
 * security rules.
 */
export function PlatformHomePage() {
  const { distributorId = null } = useParams();
  const [search] = useSearchParams();
  const filter = filterOf(search);
  const copy = FILTER_COPY[filter];
  usePageTitle(distributorId ? 'Revisar una distribuidora' : copy.title.replace('.', ''));
  const isDesktop = useIsDesktop();
  const list = usePlatformDistributors(filter);
  const showsList = isDesktop || distributorId === null;
  const showsReview = isDesktop || distributorId !== null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        dense
        title={copy.title}
        lead={copy.lead}
        aside={
          showsList ? (
            <ButtonLink to={ROUTES.account} variant="line" size="sm">
              Revisar mi cuenta
            </ButtonLink>
          ) : (
            <ButtonLink to={platformListPath(filter)} variant="quiet" size="sm">
              <ArrowLeft aria-hidden="true" strokeWidth={ICON_STROKE} />
              Volver a la lista
            </ButtonLink>
          )
        }
      />
      <div className="grid items-start gap-4 lg:grid-cols-[22rem_minmax(0,1fr)]">
        {showsList && (
          <Panel dense className="lg:max-h-[calc(100dvh-11rem)] lg:overflow-y-auto lg:p-4">
            <ListFilter current={filter} />
            <DistributorList filter={filter} list={list} />
          </Panel>
        )}
        {showsReview && (
          <Panel dense>
            <ReviewPane key={distributorId} distributorId={distributorId} onDecided={list.reload} />
          </Panel>
        )}
      </div>
    </div>
  );
}
