import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { InlineAlert } from '@/components/common/inline-alert';
import { Panel } from '@/components/layout/page-header';
import {
  AddVehicleButton,
  VEHICLES_FULL,
  VehicleList,
  VehicleListSkeleton,
  VehiclesEmpty,
} from '@/components/vehicles/vehicle-list';
import { MAX_VEHICLES } from '@/domain/vehicles/constants';
import { sortVehicles, type Vehicle } from '@/domain/vehicles/vehicle';
import { setVehicleActive } from '@/features/vehicles/vehicle-actions';
import { describeVehicleError } from '@/features/vehicles/vehicle-messages';
import { useOnlineStatus } from '@/lib/use-online-status';
import { cn } from '@/lib/utils';
import { VehicleFormPanel } from './vehicle-form-panel';

/** What the right-hand panel (the whole screen, on a phone) is doing. */
export type VehicleEditing = { vehicle: Vehicle | null } | null;

type VehiclesBoardProps = {
  distributorId: string;
  vehicles: readonly Vehicle[] | null;
  isRefreshing: boolean;
  canEdit: boolean;
  editing: VehicleEditing;
  onEdit: (editing: VehicleEditing) => void;
  reload: () => void;
};

function Counts({ vehicles }: { vehicles: readonly Vehicle[] }) {
  const inUse = vehicles.filter((vehicle) => vehicle.active).length;
  return (
    <p className="text-sm font-semibold text-muted-foreground tabular-nums">
      {inUse} en uso · {vehicles.length - inUse} sin usar ·{' '}
      <span className="whitespace-nowrap">
        {vehicles.length} de {MAX_VEHICLES}
      </span>
    </p>
  );
}

/**
 * The vehicles and, for the owner and the dispatcher, the form beside them (PLAN 3.3), like the
 * catalogue: on a desktop the form opens on the right; on a phone it takes the list's place.
 * Taking a vehicle out of use asks nothing: it is undone with one tap and keeps its slot.
 */
export function VehiclesBoard(props: VehiclesBoardProps) {
  const { distributorId, vehicles, isRefreshing, canEdit, editing, onEdit, reload } = props;
  const isOnline = useOnlineStatus();
  const [busyId, setBusyId] = useState<string | null>(null);
  const isRunning = useRef(false);
  const sorted = vehicles && sortVehicles(vehicles);

  const toggleActive = async (vehicle: Vehicle) => {
    if (isRunning.current) return;
    isRunning.current = true;
    setBusyId(vehicle.id);
    try {
      await setVehicleActive(distributorId, vehicle, !vehicle.active);
      toast.success(
        vehicle.active
          ? `${vehicle.name} ya no se ofrece al abrir una jornada.`
          : `${vehicle.name} vuelve a estar en uso.`,
      );
    } catch (error) {
      toast.error(describeVehicleError(error));
    } finally {
      isRunning.current = false;
      setBusyId(null);
      reload();
    }
  };

  const saved = (message: string) => {
    toast.success(message);
    onEdit(null);
    reload();
  };

  const controls =
    canEdit && editing === null
      ? {
          busyId,
          isLocked: busyId !== null || isRefreshing || !isOnline,
          onEdit: (vehicle: Vehicle) => onEdit({ vehicle }),
          onToggleActive: (vehicle: Vehicle) => void toggleActive(vehicle),
        }
      : undefined;

  return (
    <div
      className={cn(
        'grid grid-cols-[minmax(0,1fr)] items-start gap-4',
        editing && 'lg:grid-cols-[minmax(0,1fr)_26rem]',
      )}
    >
      <Panel dense className={cn(editing && 'max-lg:hidden')}>
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="text-lg font-bold">Vehículos</h2>
          {sorted && sorted.length > 0 && <Counts vehicles={sorted} />}
        </div>
        {!sorted && <VehicleListSkeleton />}
        {sorted?.length === 0 && (
          <VehiclesEmpty
            title={canEdit ? 'Todavía no registras vehículos.' : 'Todavía no hay vehículos.'}
            description={
              canEdit
                ? 'Añade las motos, trimotos o camiones que salen a repartir y cuántos balones lleva cada uno.'
                : 'Los vehículos los registran el titular o la central de la distribuidora.'
            }
            action={canEdit && <AddVehicleButton onAdd={() => onEdit({ vehicle: null })} isFirst />}
          />
        )}
        {sorted && sorted.length > 0 && <VehicleList vehicles={sorted} controls={controls} />}
        {canEdit && sorted && sorted.length >= MAX_VEHICLES && (
          <InlineAlert tone="info" className="mt-2">
            {VEHICLES_FULL}
          </InlineAlert>
        )}
      </Panel>
      {editing && sorted && (
        <Panel dense>
          <VehicleFormPanel
            key={editing.vehicle?.id ?? 'new'}
            distributorId={distributorId}
            vehicle={editing.vehicle}
            vehicles={sorted}
            onSaved={saved}
            onCancel={() => onEdit(null)}
          />
        </Panel>
      )}
    </div>
  );
}
