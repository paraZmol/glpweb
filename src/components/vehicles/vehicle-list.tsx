import { Pencil, Plus } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/common/button';
import { Bone, LoadingRegion } from '@/components/common/skeleton';
import { StateChip } from '@/components/common/state-chip';
import { EmptyState } from '@/components/common/state-views';
import { Stagger } from '@/components/motion/stagger';
import { MAX_VEHICLES } from '@/domain/vehicles/constants';
import { VehicleLimitError } from '@/domain/vehicles/errors';
import type { Vehicle } from '@/domain/vehicles/vehicle';
import { describeVehicleError, VEHICLE_KIND_LABELS } from '@/features/vehicles/vehicle-messages';
import { ICON_STROKE } from '@/lib/icons';
import { VEHICLE_KIND_ICONS, VehicleKindTile } from './vehicle-kind';

const SKELETON_ROWS = 3;
const EMPTY_ICON_PX = 'size-16';

/** "Lleva hasta 3 balones", the one number that decides a load (PLAN 3.3). */
export function capacityText(capacity: number): string {
  return `Lleva hasta ${capacity} ${capacity === 1 ? 'balón' : 'balones'}`;
}

/** What the owner and the dispatcher can do on each vehicle. */
export interface VehicleControls {
  /** The vehicle whose "in use" switch is waiting for the database. */
  busyId: string | null;
  isLocked: boolean;
  onEdit: (vehicle: Vehicle) => void;
  onToggleActive: (vehicle: Vehicle) => void;
}

/** Phone: the state goes under the name, like the catalogue, so a long name keeps its width. */
function VehicleRow({ vehicle, controls }: { vehicle: Vehicle; controls?: VehicleControls }) {
  const isBusy = controls?.busyId === vehicle.id;
  return (
    <article className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-2 py-4 lg:flex lg:gap-y-3">
      <div className="row-span-2 self-start lg:self-center">
        <VehicleKindTile kind={vehicle.kind} isMuted={!vehicle.active} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
        <h3 className="max-w-full text-lg font-bold wrap-anywhere">{vehicle.name}</h3>
        <p className="text-[0.9375rem] font-semibold text-muted-foreground">
          {VEHICLE_KIND_LABELS[vehicle.kind]} ·{' '}
          <span className="tabular-nums">{vehicle.plate ?? 'Sin placa'}</span>
        </p>
        <p className="font-heading font-bold tabular-nums">
          {capacityText(vehicle.capacityCylinders)}
        </p>
      </div>
      <div className="col-start-2 lg:shrink-0">
        <StateChip state={vehicle.active ? 'free' : 'offline'}>
          {vehicle.active ? 'En uso' : 'Sin usar'}
        </StateChip>
      </div>
      {controls && (
        <div className="col-span-2 mt-1 flex justify-end gap-2 lg:mt-0">
          <Button
            type="button"
            variant="line"
            size="sm"
            disabled={controls.isLocked}
            onClick={() => controls.onEdit(vehicle)}
          >
            <Pencil aria-hidden="true" strokeWidth={ICON_STROKE} />
            Editar<span className="sr-only"> {vehicle.name}</span>
          </Button>
          <Button
            type="button"
            variant={vehicle.active ? 'quiet' : 'soft'}
            size="sm"
            className="lg:min-w-36"
            disabled={controls.isLocked && !isBusy}
            loading={isBusy}
            loadingLabel="Guardando…"
            onClick={() => controls.onToggleActive(vehicle)}
          >
            {vehicle.active ? 'Dejar de usar' : 'Volver a usar'}
            <span className="sr-only"> {vehicle.name}</span>
          </Button>
        </div>
      )}
    </article>
  );
}

/** The vehicles of the distributor, in use first (PLAN 3.3). */
export function VehicleList({
  vehicles,
  controls,
}: {
  vehicles: readonly Vehicle[];
  controls?: VehicleControls;
}) {
  return (
    <Stagger as="ul" className="flex flex-col divide-y" itemClassName="list-none">
      {vehicles.map((vehicle) => (
        <VehicleRow key={vehicle.id} vehicle={vehicle} controls={controls} />
      ))}
    </Stagger>
  );
}

export function VehicleListSkeleton() {
  return (
    <LoadingRegion label="Cargando los vehículos" className="flex flex-col divide-y">
      {Array.from({ length: SKELETON_ROWS }, (_, index) => (
        <div key={index} className="flex items-center gap-4 py-4">
          <Bone className="size-14 shrink-0 rounded-lg" />
          <div className="flex flex-1 flex-col gap-2">
            <Bone className="h-5 w-40 max-w-full" />
            <Bone className="h-4 w-56 max-w-full" />
          </div>
          <Bone className="h-7 w-20 rounded-full" />
        </div>
      ))}
    </LoadingRegion>
  );
}

type VehiclesEmptyProps = { title: string; description: string; action?: ReactNode };

export function VehiclesEmpty({ title, description, action }: VehiclesEmptyProps) {
  const Icon = VEHICLE_KIND_ICONS.truck;
  return (
    <EmptyState
      className="py-4"
      symbol={<Icon aria-hidden="true" className={EMPTY_ICON_PX} strokeWidth={ICON_STROKE} />}
      title={title}
      description={description}
      action={action}
    />
  );
}

export function AddVehicleButton({
  onAdd,
  isFirst = false,
}: {
  onAdd: () => void;
  isFirst?: boolean;
}) {
  return (
    <Button type="button" onClick={onAdd} className="max-sm:w-full">
      <Plus aria-hidden="true" strokeWidth={ICON_STROKE} />
      {isFirst ? 'Añadir tu primer vehículo' : 'Añadir vehículo'}
    </Button>
  );
}

export const VEHICLES_FULL = describeVehicleError(new VehicleLimitError(MAX_VEHICLES));
