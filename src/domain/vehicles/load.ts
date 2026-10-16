import type { Vehicle } from './vehicle';

/**
 * The vehicle as it was when a shift was declared (phase 5 stores this copy in the shift).
 * "Changing the capacity of a vehicle does not rewrite loads already approved" (glp-domain §5):
 * a shift checks its load against this copy, never against the vehicle as it is now.
 */
export interface VehicleSnapshot {
  vehicleId: string;
  kind: Vehicle['kind'];
  name: string;
  plate: string | null;
  capacityCylinders: number;
}

export function vehicleSnapshotOf(vehicle: Vehicle): VehicleSnapshot {
  return {
    vehicleId: vehicle.id,
    kind: vehicle.kind,
    name: vehicle.name,
    plate: vehicle.plate,
    capacityCylinders: vehicle.capacityCylinders,
  };
}

/** One line of a load: how many cylinders of one product. */
export interface LoadLine {
  productId: string;
  quantity: number;
}

/** Cylinders of a load in all, whatever their weight. */
export function cylindersIn(load: readonly LoadLine[]): number {
  return load.reduce((total, line) => total + line.quantity, 0);
}

/** Whether `load` fits the capacity the shift recorded for its vehicle. */
export function loadFitsVehicle(load: readonly LoadLine[], vehicle: VehicleSnapshot): boolean {
  return cylindersIn(load) <= vehicle.capacityCylinders;
}
