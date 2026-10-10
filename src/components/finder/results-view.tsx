import { GasCylinder } from '@/components/brand/gas-cylinder';
import { LoadingRegion } from '@/components/common/skeleton';
import { EmptyState, ErrorState } from '@/components/common/state-views';
import { Stagger } from '@/components/motion/stagger';
import { OfflineError } from '@/domain/tenancy/errors';
import type { NearbyDistributor } from '@/domain/tenancy/nearby';
import type { AsyncResource } from '@/lib/use-async-resource';
import { CoverageAside } from './coverage-aside';
import { DistributorCard, DistributorCardSkeleton } from './distributor-card';
import { NobodyCovers } from './nobody-covers';

const SYMBOL_PX = 64;
const SKELETON_CARDS = 3;
const LIST_GRID = 'grid gap-4 xl:grid-cols-2';

export type ResultsViewProps = {
  /** `idle` while the person has not said where; then the search itself. */
  resource: AsyncResource<NearbyDistributor[]>;
  isOnline: boolean;
  onRetry: () => void;
  /** The moment the list is drawn, to say who attends right now. */
  now: Date;
};

function headingOf(resource: ResultsViewProps['resource']): string {
  if (resource.status !== 'ready') return 'Distribuidoras cerca de ti';
  return resource.data.length > 0 ? 'Llegan a tu punto' : 'Nadie llega todavía';
}

function Results({ resource, isOnline, onRetry, now }: ResultsViewProps) {
  if (resource.status === 'idle') {
    return (
      <EmptyState
        className="rounded-xl bg-card p-6 shadow-card"
        symbol={<GasCylinder weightKg={10} tone="mono" height={SYMBOL_PX} />}
        title="Dinos dónde y vemos quién llega."
        description="Usa tu ubicación o escribe las coordenadas del punto: la lista aparece aquí, de la más cercana a la más lejana."
      />
    );
  }
  if (resource.status === 'loading') {
    return (
      <LoadingRegion label="Buscando distribuidoras cerca de ti" className={LIST_GRID}>
        {Array.from({ length: SKELETON_CARDS }, (_, index) => (
          <DistributorCardSkeleton key={index} />
        ))}
      </LoadingRegion>
    );
  }
  if (resource.status === 'error') {
    const isOffline = !isOnline || resource.error instanceof OfflineError;
    return isOffline ? (
      <ErrorState
        title="Sin conexión."
        description="Para buscar distribuidoras necesitas internet. Tu ubicación sigue guardada: vuelve a intentar cuando regrese la señal."
        onRetry={onRetry}
      />
    ) : (
      <ErrorState
        title="No pudimos buscar distribuidoras."
        description="Algo falló de nuestro lado o en la conexión. Vuelve a intentar en un momento."
        onRetry={onRetry}
      />
    );
  }
  if (resource.data.length === 0) return <NobodyCovers />;
  return (
    <Stagger as="ul" className={LIST_GRID}>
      {resource.data.map((entry, index) => (
        <DistributorCard
          key={entry.distributor.id}
          entry={entry}
          now={now}
          isNearest={index === 0}
        />
      ))}
    </Stagger>
  );
}

/**
 * The list of distributors that reach the person's point and, on desktop, the place of the map
 * beside it (PLAN 2.6). It only draws what it is given: every remote state has its own shape.
 */
export function ResultsView(props: ResultsViewProps) {
  const { resource } = props;
  const found = resource.status === 'ready' ? resource.data : null;

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_27.5rem]">
      <section aria-labelledby="resultados">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
          <h2 id="resultados" className="text-[1.625rem] font-extrabold lg:text-4xl">
            {headingOf(resource)}
          </h2>
          {found && found.length > 0 && (
            <p className="text-muted-foreground">De la más cercana a la más lejana</p>
          )}
        </div>
        <Results {...props} />
      </section>
      <CoverageAside found={found} />
    </div>
  );
}
