import { ChevronRight } from 'lucide-react';
import { NavLink } from 'react-router';
import { Bone, LoadingRegion } from '@/components/common/skeleton';
import { StateChip } from '@/components/common/state-chip';
import { EmptyState, ErrorState } from '@/components/common/state-views';
import { DEFAULT_TIMEZONE, PENDING_LISTINGS_LIMIT } from '@/domain/tenancy/constants';
import { OfflineError } from '@/domain/tenancy/errors';
import type { PendingListing } from '@/features/platform/platform-actions';
import { formatDateTime } from '@/lib/format-date';
import { ICON_STROKE } from '@/lib/icons';
import { platformListingPath } from '@/lib/routes';
import type { ReloadableResource } from '@/lib/use-async-resource';

const SKELETON_ROWS = 3;

function PendingRow({ listing }: { listing: PendingListing }) {
  const { distributorId, control } = listing;
  const wasSentBack = Boolean(control.reviewNote);
  return (
    <li>
      <NavLink
        to={platformListingPath(distributorId)}
        className="flex items-center gap-3 rounded-lg px-3 py-3 transition-colors motion-fast hover:bg-muted aria-[current=page]:bg-muted"
      >
        <div className="min-w-0 flex-1">
          <p className="font-heading font-bold tabular-nums">
            Alta del {formatDateTime(control.createdAt, DEFAULT_TIMEZONE)}
          </p>
          <p className="truncate text-[0.8125rem] text-muted-foreground">
            Identificador {distributorId}
          </p>
          <StateChip state={wasSentBack ? 'danger' : 'paused'} className="mt-1.5">
            {wasSentBack ? 'Con cambios pedidos' : 'Sin revisar'}
          </StateChip>
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

/**
 * The listings that wait for a decision, oldest first (PLAN 2.11). Each entry is what the
 * control document holds: the name of the distributor arrives when it is opened.
 */
export function PendingList({ pending }: { pending: ReloadableResource<PendingListing[]> }) {
  if (pending.status === 'error') {
    const isOffline = pending.error instanceof OfflineError;
    return (
      <ErrorState
        className="shadow-none"
        title={isOffline ? 'Sin conexión.' : 'No pudimos cargar las altas pendientes.'}
        description="Vuelve a intentar en un momento."
        onRetry={pending.reload}
      />
    );
  }
  if (pending.status !== 'ready') {
    return (
      <LoadingRegion label="Cargando las altas pendientes" className="flex flex-col gap-2">
        {Array.from({ length: SKELETON_ROWS }, (_unused, index) => (
          <Bone key={index} className="h-20 rounded-lg" />
        ))}
      </LoadingRegion>
    );
  }
  if (pending.data.length === 0) {
    return (
      <EmptyState
        title="No hay altas pendientes."
        description="Cuando alguien registre una distribuidora, o cambie su nombre o un teléfono, va a aparecer aquí para revisarla."
      />
    );
  }
  return (
    <>
      <ul className="flex flex-col gap-1">
        {pending.data.map((listing) => (
          <PendingRow key={listing.distributorId} listing={listing} />
        ))}
      </ul>
      {pending.data.length >= PENDING_LISTINGS_LIMIT && (
        <p className="mt-3 px-3 text-[0.8125rem] text-muted-foreground tabular-nums">
          Se muestran las {PENDING_LISTINGS_LIMIT} más antiguas. Al decidir sobre ellas aparecen las
          siguientes.
        </p>
      )}
    </>
  );
}
