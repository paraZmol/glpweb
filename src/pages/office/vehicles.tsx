import { Button } from '@/components/common/button';
import { InlineAlert } from '@/components/common/inline-alert';
import { Bone, LoadingRegion } from '@/components/common/skeleton';
import { ErrorState } from '@/components/common/state-views';
import { PageHeader } from '@/components/layout/page-header';
import { AddVehicleButton } from '@/components/vehicles/vehicle-list';
import { MAX_VEHICLES } from '@/domain/vehicles/constants';
import type { Vehicle } from '@/domain/vehicles/vehicle';
import { canEditVehicles } from '@/domain/vehicles/permissions';
import { OfflineError } from '@/domain/tenancy/errors';
import { useAccount } from '@/features/account/account-context';
import { useVehicles } from '@/features/vehicles/use-vehicles';
import { usePageTitle } from '@/lib/page-title';
import { useLastReady } from '@/lib/use-last-ready';
import { useOnlineStatus } from '@/lib/use-online-status';
import { isSuspended, SuspendedNotice } from './read-only-notice';
import { useFormEntry } from './use-form-entry';
import { type VehicleEditing, VehiclesBoard } from './vehicles-board';

export const VEHICLES_STAFF_READS =
  'Los vehículos los cambian el titular y la central. Aquí los ves tal como están.';
const PLAN_READ_ONLY =
  'Tu distribuidora está en solo lectura: puedes ver tus vehículos, pero no cambiarlos hasta regularizar el plan.';
const LOCKED_WHILE_TYPING =
  'Tu distribuidora pasó a solo lectura mientras escribías: el vehículo no se guardó. Podrás registrarlo cuando vuelva a estar activa.';

/** The form a history entry names: null for a new vehicle, an id for one of the list. */
function vehicleEditingOf(value: unknown, vehicles: readonly Vehicle[] | null): VehicleEditing {
  if (value === null) return { vehicle: null };
  const vehicle = vehicles?.find((item) => item.id === value);
  return vehicle ? { vehicle } : null;
}

function VehiclesPageSkeleton() {
  return (
    <LoadingRegion label="Cargando los vehículos" className="flex flex-col gap-6">
      <Bone className="h-8 w-56" />
      <Bone className="h-80 rounded-lg" />
    </LoadingRegion>
  );
}

/**
 * `/central/vehiculos` (PLAN 3.3): the motorbikes, tricycles and trucks of the distributor and
 * how many cylinders each carries. The owner and the dispatcher add and edit them (§11,
 * 2026-10-16); a read-only distributor shows them without a single control.
 */
export function VehiclesPage() {
  usePageTitle('Vehículos');
  const { current } = useAccount();
  const isOnline = useOnlineStatus();
  const distributorId = current.status === 'ready' ? current.distributor.id : null;
  const resource = useVehicles(distributorId);
  const { data: vehicles, isRefreshing } = useLastReady(resource, distributorId);
  // A step of the history, with its distributor: "back" closes it, switching closes it.
  const entry = useFormEntry('vehicleForm', distributorId);
  if (current.status !== 'ready') return <VehiclesPageSkeleton />;

  const { distributor, membership, isWritable } = current;
  const managesVehicles = canEditVehicles(membership.role);
  const canEdit = managesVehicles && isWritable;
  const isFormOpen = entry.value !== undefined;
  const editing = canEdit && isFormOpen ? vehicleEditingOf(entry.value, vehicles) : null;
  const onEdit = (next: VehicleEditing) =>
    next ? entry.open(next.vehicle?.id ?? null) : entry.close();
  const canAdd =
    canEdit &&
    editing === null &&
    vehicles !== null &&
    vehicles.length > 0 &&
    vehicles.length < MAX_VEHICLES;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        dense
        title={managesVehicles ? 'Tus vehículos.' : 'Vehículos.'}
        lead={`Las motos, trimotos y camiones de ${distributor.name}, y cuántos balones lleva cada uno.`}
        aside={canAdd && <AddVehicleButton onAdd={() => onEdit({ vehicle: null })} />}
      />
      {!isWritable && (
        <InlineAlert tone="info">
          {isSuspended(distributor.status) ? <SuspendedNotice /> : PLAN_READ_ONLY}
        </InlineAlert>
      )}
      {!managesVehicles && <InlineAlert tone="info">{VEHICLES_STAFF_READS}</InlineAlert>}
      {managesVehicles && !isWritable && isFormOpen && (
        <div className="flex flex-col items-start gap-3">
          <InlineAlert tone="error">{LOCKED_WHILE_TYPING}</InlineAlert>
          <Button type="button" variant="line" size="sm" onClick={entry.close}>
            Entendido
          </Button>
        </div>
      )}
      {resource.status === 'error' && !vehicles ? (
        <ErrorState
          title={isOnline ? 'No pudimos cargar los vehículos.' : 'Sin conexión.'}
          description={
            !isOnline || resource.error instanceof OfflineError
              ? 'Para ver tus vehículos necesitas internet. Vuelve a intentar cuando regrese la señal.'
              : 'Algo falló de nuestro lado o en la conexión. Vuelve a intentar en un momento.'
          }
          onRetry={resource.reload}
          className="rounded-lg"
        />
      ) : (
        <VehiclesBoard
          distributorId={distributor.id}
          vehicles={vehicles}
          isRefreshing={isRefreshing}
          canEdit={canEdit}
          isReadOnly={managesVehicles && !isWritable}
          editing={editing}
          onEdit={onEdit}
          reload={resource.reload}
        />
      )}
    </div>
  );
}
