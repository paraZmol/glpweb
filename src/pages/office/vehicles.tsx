import { useState } from 'react';
import { InlineAlert } from '@/components/common/inline-alert';
import { Bone, LoadingRegion } from '@/components/common/skeleton';
import { ErrorState } from '@/components/common/state-views';
import { PageHeader } from '@/components/layout/page-header';
import { AddVehicleButton } from '@/components/vehicles/vehicle-list';
import { MAX_VEHICLES } from '@/domain/vehicles/constants';
import { canEditVehicles } from '@/domain/vehicles/permissions';
import { OfflineError } from '@/domain/tenancy/errors';
import { useAccount } from '@/features/account/account-context';
import { useVehicles } from '@/features/vehicles/use-vehicles';
import { usePageTitle } from '@/lib/page-title';
import { useLastReady } from '@/lib/use-last-ready';
import { useOnlineStatus } from '@/lib/use-online-status';
import { isSuspended, SuspendedNotice } from './read-only-notice';
import { type VehicleEditing, VehiclesBoard } from './vehicles-board';

export const VEHICLES_STAFF_READS =
  'Los vehículos los cambian el titular y la central. Aquí los ves tal como están.';
const PLAN_READ_ONLY =
  'Tu distribuidora está en solo lectura: puedes ver tus vehículos, pero no cambiarlos hasta regularizar el plan.';

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
  // Remembered with its distributor: switching to another one closes the form.
  const [editingAt, setEditingAt] = useState<{ at: string; editing: VehicleEditing } | null>(null);
  if (current.status !== 'ready') return <VehiclesPageSkeleton />;

  const { distributor, membership, isWritable } = current;
  const managesVehicles = canEditVehicles(membership.role);
  const canEdit = managesVehicles && isWritable;
  const editing = canEdit && editingAt?.at === distributor.id ? editingAt.editing : null;
  const onEdit = (next: VehicleEditing) =>
    setEditingAt(next ? { at: distributor.id, editing: next } : null);
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
          editing={editing}
          onEdit={onEdit}
          reload={resource.reload}
        />
      )}
    </div>
  );
}
