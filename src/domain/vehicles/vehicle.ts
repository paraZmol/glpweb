import { MAX_VEHICLES } from './constants';

/** What a vehicle is. The truck also covers vans and pick-ups; it is the one with a helper. */
export const VEHICLE_KINDS = ['motorcycle', 'tricycle', 'truck'] as const;
export type VehicleKind = (typeof VEHICLE_KINDS)[number];

/**
 * A vehicle of a distributor (PLAN 3.3), at `/distributors/{d}/vehicles/{slot}`. The driver
 * picks one when it opens a shift (phase 5), and its load is checked against the capacity.
 */
export interface Vehicle {
  /** Slot, `v00` … `v29`. */
  id: string;
  kind: VehicleKind;
  /** How the staff calls it: "Moto roja", "Camión 1". */
  name: string;
  /** Uppercase letters and digits with an optional hyphen; null when it has none. */
  plate: string | null;
  /** Cylinders it carries in all, of any weight. */
  capacityCylinders: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** A vehicle as the form leaves it, ready to store. */
export type NewVehicle = Pick<Vehicle, 'kind' | 'name' | 'plate' | 'capacityCylinders' | 'active'>;

/** Everything of a vehicle can change except its slot and its creation date. */
export const EDITABLE_VEHICLE_FIELDS = [
  'kind',
  'name',
  'plate',
  'capacityCylinders',
  'active',
] as const satisfies readonly (keyof NewVehicle)[];

export type VehiclePatch = Partial<NewVehicle>;

const SLOT_DIGITS = 2;

/** `v00` … `v29`: the fixed ids vehicles may use (firebase/firestore.rules: `^v[0-2][0-9]$`). */
export const VEHICLE_SLOT_IDS: readonly string[] = Array.from(
  { length: MAX_VEHICLES },
  (_, index) => `v${String(index).padStart(SLOT_DIGITS, '0')}`,
);

/** The first slot no vehicle uses; null when every slot is taken. */
export function freeVehicleSlot(vehicles: readonly Pick<Vehicle, 'id'>[]): string | null {
  const used = new Set(vehicles.map((vehicle) => vehicle.id));
  return VEHICLE_SLOT_IDS.find((slot) => !used.has(slot)) ?? null;
}

/** Active first, then by name, so the driver finds its own at once. */
export function sortVehicles<T extends Pick<Vehicle, 'name' | 'active' | 'id'>>(
  vehicles: readonly T[],
): T[] {
  return [...vehicles].sort(
    (a, b) =>
      Number(b.active) - Number(a.active) ||
      a.name.localeCompare(b.name, 'es') ||
      a.id.localeCompare(b.id),
  );
}

/**
 * Whether another vehicle of the same distributor already carries `plate`. The rules cannot
 * keep plates unique (PLAN §9): the form warns with this before saving.
 */
export function plateInUse(
  vehicles: readonly Pick<Vehicle, 'id' | 'plate'>[],
  plate: string | null,
  exceptId: string | null = null,
): boolean {
  if (plate === null) return false;
  return vehicles.some((vehicle) => vehicle.id !== exceptId && vehicle.plate === plate);
}
