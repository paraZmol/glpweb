import { MapGap } from '@/components/common/map-gap';
import { StateChip } from '@/components/common/state-chip';
import { formatDistanceKm } from '@/domain/geo/coordinates';
import type { NearbyDistributor } from '@/domain/tenancy/nearby';

function summaryOf(found: NearbyDistributor[] | null): { title: string; detail: string } {
  const [nearest] = found ?? [];
  if (found === null) {
    return {
      title: 'Aquí va a ir el mapa.',
      detail: 'Con las plantas que te cubren y tu punto. Llega en una próxima versión.',
    };
  }
  if (!nearest) {
    return {
      title: 'Ninguna distribuidora te cubre.',
      detail: 'Prueba con otro punto, o mira más abajo cómo avisarle a la tuya.',
    };
  }
  return {
    title:
      found.length === 1
        ? '1 distribuidora te cubre.'
        : `${found.length} distribuidoras te cubren.`,
    detail: `La más cercana está a ${formatDistanceKm(nearest.distanceKm)} de tu punto.`,
  };
}

/**
 * Desktop only: the column the coverage map will take (phase 6). Until then it is a designed
 * gap with a real summary of the search; `found` is null while there is nothing to count.
 */
export function CoverageAside({ found }: { found: NearbyDistributor[] | null }) {
  const { title, detail } = summaryOf(found);
  return (
    <aside className="sticky top-[calc(var(--top-inset)+1.5rem)] hidden overflow-hidden rounded-2xl bg-card shadow-raised lg:block">
      <div className="p-3 pb-0">
        <MapGap className="h-96" />
      </div>
      <div className="flex items-center justify-between gap-3 p-5">
        <div className="min-w-0">
          <p className="font-heading text-lg leading-tight font-bold tabular-nums">{title}</p>
          <p className="mt-1 text-sm text-muted-foreground tabular-nums">{detail}</p>
        </div>
        {found !== null && (
          <StateChip state={found.length > 0 ? 'free' : 'offline'}>
            {found.length > 0 ? 'Con cobertura' : 'Sin cobertura'}
          </StateChip>
        )}
      </div>
    </aside>
  );
}
