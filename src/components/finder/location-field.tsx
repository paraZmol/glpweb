import { LocateFixed, MapPin } from 'lucide-react';
import { useId, useState } from 'react';
import { Button } from '@/components/common/button';
import { InlineAlert } from '@/components/common/inline-alert';
import { formatCoordinates } from '@/domain/geo/coordinates';
import { GEOLOCATION_FAILURE_TEXT } from '@/features/location/location-messages';
import type { DeliveryLocation } from '@/features/location/use-delivery-location';
import { ICON_STROKE } from '@/lib/icons';
import type { LocationSource, RememberedLocation } from '@/lib/last-location';
import { cn } from '@/lib/utils';
import { ManualLocation } from './manual-location';

// Said BEFORE the browser asks for the permission (tracking-pwa §1).
const WHY =
  'Tu ubicación se usa solo para ver qué distribuidoras llegan hasta ti. Queda en este dispositivo, no en tu cuenta.';

const SOURCE_LABELS: Record<LocationSource, string> = {
  device: 'Tu ubicación',
  manual: 'El punto que escribiste',
};

type LocationFieldProps = {
  delivery: DeliveryLocation;
  /** False when another button of the screen is already the main action. */
  isMainAction?: boolean;
  className?: string;
};

/**
 * "Entregar en" (PLAN 2.6): where the search of distributors starts from. Without a point it
 * offers the two ways of giving one; with a point it shows it and lets the person change it.
 */
export function LocationField({ delivery, isMainAction = true, className }: LocationFieldProps) {
  const { location, locateState, locate, enterManually, forget } = delivery;
  const whyId = useId();
  // Editing belongs to the point on display: a new point closes the editor by itself.
  const [editing, setEditing] = useState<RememberedLocation | null>(null);
  const isChoosing = location === null || editing === location;
  const hasFailed = locateState.status === 'failed';

  return (
    <section
      aria-label="Dónde entregar"
      className={cn('rounded-2xl bg-card p-4 shadow-raised', className)}
    >
      <div className="flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary-text">
          <MapPin aria-hidden="true" className="size-5" strokeWidth={ICON_STROKE} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[0.8125rem] font-semibold text-muted-foreground">Entregar en</p>
          <p className="truncate font-heading text-lg leading-tight font-bold">
            {location ? SOURCE_LABELS[location.source] : 'Todavía no nos dijiste dónde'}
          </p>
          {location && (
            <p className="truncate text-sm text-muted-foreground tabular-nums">
              {formatCoordinates(location.point)}
            </p>
          )}
        </div>
        {location && (
          <Button
            variant="soft"
            size="sm"
            aria-expanded={isChoosing}
            onClick={() => setEditing(isChoosing ? null : location)}
          >
            Cambiar
          </Button>
        )}
      </div>
      {isChoosing && (
        <div className="mt-4 flex flex-col gap-3 border-t pt-4">
          <p id={whyId} className="text-sm text-muted-foreground">
            {WHY}
          </p>
          {hasFailed && (
            <InlineAlert tone="info">{GEOLOCATION_FAILURE_TEXT[locateState.reason]}</InlineAlert>
          )}
          <Button
            variant={isMainAction && location === null ? 'primary' : 'ink'}
            aria-describedby={whyId}
            loading={locateState.status === 'locating'}
            loadingLabel="Buscando tu ubicación…"
            onClick={locate}
          >
            <LocateFixed aria-hidden="true" strokeWidth={ICON_STROKE} />
            Usar mi ubicación
          </Button>
          <ManualLocation onSubmit={enterManually} startsOpen={hasFailed} />
          {location && (
            <Button variant="quiet" size="sm" className="self-start" onClick={forget}>
              Olvidar esta ubicación
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
