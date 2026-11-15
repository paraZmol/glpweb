import { Bone, LoadingRegion } from '@/components/common/skeleton';
import { ErrorState } from '@/components/common/state-views';
import { PageHeader } from '@/components/layout/page-header';
import {
  VehicleList,
  VehicleListSkeleton,
  VehiclesEmpty,
} from '@/components/vehicles/vehicle-list';
import { sortVehicles } from '@/domain/vehicles/vehicle';
import { useAccount } from '@/features/account/account-context';
import { useVehicles } from '@/features/vehicles/use-vehicles';
import { usePageTitle } from '@/lib/page-title';
import { useLastReady } from '@/lib/use-last-ready';
import { DriverReadOnlyNotice } from './read-only-notice';

const FRAME = 'max-w-4xl rounded-lg border-2 border-foreground bg-card px-5 py-2 lg:px-7';

/**
 * `/reparto/vehiculos` (PLAN 3.3): the vehicles of the distributor and how many cylinders each
 * carries, read-only, in use first. The owner and the dispatcher change them.
 */
export function DriverVehiclesPage() {
  usePageTitle('Vehículos');
  const { current } = useAccount();
  const distributorId = current.status === 'ready' ? current.distributor.id : null;
  const resource = useVehicles(distributorId);
  const { data: vehicles } = useLastReady(resource, distributorId);
  if (current.status !== 'ready') {
    return (
      <LoadingRegion label="Cargando los vehículos" className="flex flex-col gap-6">
        <Bone className="h-10 w-3/4 max-w-sm" />
        <Bone className="h-80 max-w-4xl rounded-lg" />
      </LoadingRegion>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Vehículos."
        lead={`Los vehículos de ${current.distributor.name} y cuántos balones lleva cada uno. Los cambian el titular y la central.`}
      />
      {!current.isWritable && <DriverReadOnlyNotice distributor={current.distributor} />}
      {resource.status === 'error' && !vehicles ? (
        <ErrorState
          title="No pudimos cargar los vehículos."
          description="Revisa la señal y vuelve a intentar."
          onRetry={resource.reload}
          className="max-w-4xl rounded-lg"
        />
      ) : (
        <section aria-label="Vehículos" className={FRAME}>
          {!vehicles && <VehicleListSkeleton />}
          {vehicles?.length === 0 && (
            <VehiclesEmpty
              title="Todavía no hay vehículos."
              description="Los registran el titular o la central de la distribuidora."
            />
          )}
          {vehicles && vehicles.length > 0 && <VehicleList vehicles={sortVehicles(vehicles)} />}
        </section>
      )}
    </div>
  );
}
