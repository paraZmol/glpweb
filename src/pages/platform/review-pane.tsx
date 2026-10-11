import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { Bone, LoadingRegion } from '@/components/common/skeleton';
import { EmptyState, ErrorState } from '@/components/common/state-views';
import {
  isInPlatformList,
  type PlatformListFilter,
  platformListOf,
} from '@/domain/tenancy/listing';
import { useAccount } from '@/features/account/account-context';
import { useListingReview } from '@/features/platform/use-listing-review';
import { searchOf } from './listing-labels';
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
  /** The list on screen, which also gives the screen its title. */
  filter: PlatformListFilter;
  /** After a decision the list changes too. */
  onDecided: () => void;
};

/** The distributor that is open in the platform panel: loading, missing, failed or its review. */
export function ReviewPane({ distributorId, filter, onDecided }: ReviewPaneProps) {
  const { session } = useAccount();
  const navigate = useNavigate();
  const review = useListingReview(distributorId);
  const hasDecided = useRef(false);
  const control = review.status === 'ready' ? review.data?.control : undefined;
  const ownList = control && !isInPlatformList(control, filter) ? platformListOf(control) : null;

  // A distributor opened by its address (or from a list it has left since) is not in the list
  // the address names: the panel moves to the list it is in, so the title, the lead and the rows
  // beside it speak of what is open. Not after a decision taken here: whoever works through the
  // pending ones stays among them.
  useEffect(() => {
    if (ownList === null || hasDecided.current) return;
    void navigate({ search: searchOf(ownList) }, { replace: true });
  }, [ownList, navigate]);

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
    hasDecided.current = true;
    review.reload();
    onDecided();
  };
  return <ListingReviewView review={review.data} admin={session} onDecided={decided} />;
}
