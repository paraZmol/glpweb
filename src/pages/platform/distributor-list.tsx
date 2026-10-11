import { ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { NavLink } from 'react-router';
import { Button } from '@/components/common/button';
import { InlineAlert } from '@/components/common/inline-alert';
import { Bone, LoadingRegion } from '@/components/common/skeleton';
import { StateChip } from '@/components/common/state-chip';
import { EmptyState, ErrorState } from '@/components/common/state-views';
import { DEFAULT_TIMEZONE } from '@/domain/tenancy/constants';
import { OfflineError } from '@/domain/tenancy/errors';
import { listingStateOf, type PlatformListFilter } from '@/domain/tenancy/listing';
import type { ListedDistributor } from '@/features/platform/platform-actions';
import type { PlatformDistributors } from '@/features/platform/use-platform-distributors';
import { formatDateTime } from '@/lib/format-date';
import { ICON_STROKE } from '@/lib/icons';
import { distributorPath, platformListingPath } from '@/lib/routes';
import { FILTER_COPY, LISTING_LABELS, PLAN_LABELS, searchOf } from './listing-labels';

const SKELETON_ROWS = 3;

type RowProps = { listed: ListedDistributor; filter: PlatformListFilter; now: Date };

function DistributorRow({ listed, filter, now }: RowProps) {
  const { distributorId, control } = listed;
  const listing = LISTING_LABELS[listingStateOf(control, now)];
  const founded = `Alta del ${formatDateTime(control.createdAt, DEFAULT_TIMEZONE)}`;
  const isStopped = control.status === 'suspended' || control.status === 'pastDue';
  return (
    <li>
      <NavLink
        to={{ pathname: platformListingPath(distributorId), search: searchOf(filter) }}
        className="flex items-center gap-3 rounded-lg px-3 py-3 transition-colors motion-fast hover:bg-muted aria-[current=page]:bg-muted"
      >
        <div className="min-w-0 flex-1">
          {/* A control document older than the copy of the name shows when it was founded. */}
          <p className="truncate font-heading font-bold">{control.distributorName ?? founded}</p>
          <p className="truncate text-[0.8125rem] text-muted-foreground tabular-nums">
            {control.slug ? `${distributorPath(control.slug)} · ` : ''}
            {control.distributorName ? founded : 'Sin nombre en la lista'}
          </p>
          <p className="truncate text-[0.8125rem] text-muted-foreground">
            Identificador {distributorId}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <StateChip state={listing.state}>{listing.text}</StateChip>
            {isStopped && (
              <span className="text-[0.8125rem] font-bold text-muted-foreground">
                {PLAN_LABELS[control.status]}
              </span>
            )}
          </div>
        </div>
        <ChevronRight
          aria-hidden="true"
          className="size-5 shrink-0 text-muted-foreground"
          strokeWidth={ICON_STROKE}
        />
      </NavLink>
    </li>
  );
}

type ListProps = { filter: PlatformListFilter; list: PlatformDistributors };

/**
 * One list of the platform panel (PLAN 2.11), oldest first and a page at a time: the listings
 * that wait for a decision, the approved distributors or the suspended ones. Each row is what
 * the control document holds, which includes the name and the link.
 */
export function DistributorList({ filter, list }: ListProps) {
  // Judged once when the list is shown: a state does not flip under the reader.
  const [now] = useState(() => new Date());
  if (list.status === 'error') {
    const isOffline = list.error instanceof OfflineError;
    return (
      <ErrorState
        className="shadow-none"
        title={isOffline ? 'Sin conexión.' : 'No pudimos cargar esta lista.'}
        description="Vuelve a intentar en un momento."
        onRetry={list.reload}
      />
    );
  }
  if (list.status !== 'ready') {
    return (
      <LoadingRegion label="Cargando la lista" className="flex flex-col gap-2">
        {Array.from({ length: SKELETON_ROWS }, (_unused, index) => (
          <Bone key={index} className="h-24 rounded-lg" />
        ))}
      </LoadingRegion>
    );
  }
  if (list.items.length === 0) return <EmptyState {...FILTER_COPY[filter].empty} />;
  return (
    <>
      <ul className="flex flex-col gap-1">
        {list.items.map((listed) => (
          <DistributorRow key={listed.distributorId} listed={listed} filter={filter} now={now} />
        ))}
      </ul>
      {list.loadMoreError !== null && (
        <InlineAlert tone="error" className="mt-3">
          No pudimos cargar más. Vuelve a intentar.
        </InlineAlert>
      )}
      {list.hasMore && (
        <Button
          type="button"
          variant="line"
          size="sm"
          className="mt-3 w-full"
          loading={list.isLoadingMore}
          loadingLabel="Cargando más…"
          onClick={list.loadMore}
        >
          Cargar más
        </Button>
      )}
    </>
  );
}
