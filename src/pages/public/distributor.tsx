import { useState } from 'react';
import { useParams } from 'react-router';
import { Highlight } from '@/components/brand/highlight';
import { ButtonLink } from '@/components/common/button';
import { Bone, LoadingRegion } from '@/components/common/skeleton';
import { ErrorState } from '@/components/common/state-views';
import { DistributorView } from '@/components/distributor/distributor-view';
import { OfflineError } from '@/domain/tenancy/errors';
import { describeDays, formatTimeOfDay } from '@/domain/tenancy/schedule';
import type { PublicDistributor } from '@/domain/tenancy/types';
import { useDistributorBySlug } from '@/features/tenancy/use-distributor-by-slug';
import { usePageDescription, usePageTitle } from '@/lib/page-title';
import { ROUTES } from '@/lib/routes';
import { useOnlineStatus } from '@/lib/use-online-status';

const LOADING_TITLE = 'Distribuidora';
const MISSING_TITLE = 'Distribuidora no encontrada';

function descriptionOf({ name, coverageRadiusKm, schedule }: PublicDistributor): string {
  const hours = `${formatTimeOfDay(schedule.opensAt)} a ${formatTimeOfDay(schedule.closesAt)}`;
  const days = describeDays(schedule.days).toLowerCase();
  return `${name}, distribuidora de gas en Hornilla. Reparte hasta ${coverageRadiusKm} km de su planta y atiende ${days}, de ${hours}.`;
}

/** The shape of the cover and of the two cards, so nothing jumps when the data arrives. */
function DistributorSkeleton() {
  return (
    <LoadingRegion label="Cargando la distribuidora" className="flex flex-1 flex-col">
      <Bone className="h-82 w-full rounded-none rounded-b-2xl lg:mx-auto lg:mt-4 lg:h-100 lg:max-w-7xl lg:rounded-3xl" />
      <div className="mx-auto w-full max-w-7xl px-4 lg:px-8">
        <Bone className="relative -mt-8 h-18 rounded-xl lg:mt-8 lg:max-w-136" />
        <Bone className="mt-8 h-9 w-56" />
        <Bone className="mt-4 h-52 rounded-xl" />
      </div>
    </LoadingRegion>
  );
}

/** A link that belongs to no distributor: the page's own 404 (PLAN 2.5). */
export function DistributorNotFound() {
  return (
    <div className="mx-auto w-full max-w-7xl flex-1 content-center px-4 py-14 lg:px-8 lg:py-24">
      <p className="font-heading text-lg font-bold text-muted-foreground tabular-nums">Error 404</p>
      <h1 className="mt-2 max-w-3xl text-[2.625rem] font-extrabold text-balance lg:text-7xl">
        Esta distribuidora <Highlight>no existe.</Highlight>
      </h1>
      <p className="mt-5 max-w-120 text-lg text-muted-foreground lg:text-xl">
        Puede que el enlace esté mal escrito o que la distribuidora haya cambiado el suyo. Busca
        quién llega a tu puerta desde el inicio.
      </p>
      <ButtonLink to={ROUTES.home} variant="primary" size="lg" className="mt-8">
        Buscar distribuidoras
      </ButtonLink>
    </div>
  );
}

function LoadError({ isOffline, onRetry }: { isOffline: boolean; onRetry: () => void }) {
  return (
    <div className="mx-auto w-full max-w-xl flex-1 px-4 py-10">
      <ErrorState
        title={isOffline ? 'Sin conexión.' : 'No pudimos cargar esta distribuidora.'}
        description={
          isOffline
            ? 'Para ver esta página necesitas internet. Vuelve a intentar cuando regrese la señal.'
            : 'Algo falló de nuestro lado o en la conexión. Vuelve a intentar en un momento.'
        }
        onRetry={onRetry}
        secondaryAction={
          <ButtonLink to={ROUTES.home} variant="line">
            Ir al inicio
          </ButtonLink>
        }
      />
    </div>
  );
}

/** `/d/{slug}` (PLAN 2.5): the public page of a distributor, for anybody with the link. */
export function DistributorPage() {
  const { slug = '' } = useParams();
  const found = useDistributorBySlug(slug);
  const isOnline = useOnlineStatus();
  // Judged once per visit: "abierto" does not flip under the reader.
  const [now] = useState(() => new Date());
  const distributor = found.status === 'ready' ? found.data : null;
  const isMissing = found.status === 'ready' && distributor === null;

  usePageTitle(distributor?.name ?? (isMissing ? MISSING_TITLE : LOADING_TITLE));
  usePageDescription(distributor ? descriptionOf(distributor) : '');

  if (found.status === 'error') {
    const isOffline = !isOnline || found.error instanceof OfflineError;
    return <LoadError isOffline={isOffline} onRetry={found.reload} />;
  }
  if (found.status !== 'ready') return <DistributorSkeleton />;
  if (distributor === null) return <DistributorNotFound />;
  return <DistributorView distributor={distributor} now={now} />;
}
