import { ButtonLink } from '@/components/common/button';
import { Bone, LoadingRegion } from '@/components/common/skeleton';
import { EmptyState } from '@/components/common/state-views';
import { PageHeader } from '@/components/layout/page-header';
import { useAccount } from '@/features/account/account-context';
import { usePageTitle } from '@/lib/page-title';
import { ROUTES } from '@/lib/routes';
import { DriverReadOnlyNotice } from './read-only-notice';

function DriverHomeSkeleton() {
  return (
    <LoadingRegion label="Cargando tu reparto" className="flex flex-col gap-6">
      <Bone className="h-10 w-3/4 max-w-sm" />
      <Bone className="h-64 max-w-2xl rounded-lg" />
    </LoadingRegion>
  );
}

/**
 * Home of the driver. The shift (jornada) arrives with phase 5. Driver ambient: ink contours of
 * 2 px, big targets, no photos and no ring; the brand stays out of the way (ui-system §13).
 */
export function DriverHomePage() {
  usePageTitle('Reparto');
  const { current } = useAccount();
  if (current.status !== 'ready') return <DriverHomeSkeleton />;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Sin jornada abierta."
        lead={`Repartes para ${current.distributor.name}.`}
      />
      {!current.isWritable && <DriverReadOnlyNotice distributor={current.distributor} />}
      <section className="max-w-2xl rounded-lg border-2 border-foreground bg-card p-5 lg:p-7">
        <EmptyState
          title="No tienes nada pendiente."
          description="Cuando tu distribuidora active las jornadas, aquí declaras tu carga, sales a repartir y cobras cada entrega."
          action={
            <ButtonLink to={ROUTES.account} variant="ink" size="lg">
              Ver mi cuenta
            </ButtonLink>
          }
        />
      </section>
    </div>
  );
}
