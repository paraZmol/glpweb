import {
  collection,
  doc,
  getDocs,
  limit,
  query,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { MAX_VEHICLES, VEHICLES_QUERY_LIMIT } from '../domain/vehicles/constants';
import { VehicleLimitError, VehicleNotFoundError } from '../domain/vehicles/errors';
import {
  type NewVehicle,
  sortVehicles,
  type Vehicle,
  VEHICLE_SLOT_IDS,
  type VehiclePatch,
} from '../domain/vehicles/vehicle';
import { vehicleConverter } from './converters';
import { guarded } from './errors';
import { db } from './firebase';
import { paths } from './paths';

const vehicleRef = (d: string, slot: string) => doc(db, paths.vehicle(d, slot));

/**
 * The vehicles of a distributor (PLAN 3.3), in use first, then by name. Its whole staff reads
 * them (the driver picks one when it opens a shift, phase 5). Cost: one read per vehicle (one
 * when there is none), plus 1 by the rules.
 */
export function listVehicles(d: string): Promise<Vehicle[]> {
  return guarded(async () => {
    const all = query(
      collection(db, paths.vehicles(d)).withConverter(vehicleConverter),
      limit(VEHICLES_QUERY_LIMIT),
    );
    return sortVehicles((await getDocs(all)).docs.map((vehicle) => vehicle.data()));
  });
}

/**
 * Owner or dispatcher, while the distributor is writable: adds a vehicle in the first free slot
 * (`v00` … `v29`). `vehicle` comes from `prepareNewVehicle`. Returns its id. When another tab
 * took that slot meanwhile, the transaction tries the next free one.
 * Throws `VehicleLimitError` (30 vehicles, switched-off ones included), `PermissionDeniedError`
 * or `OfflineError`.
 * Cost: the list (one read per vehicle) + 1 read per slot tried (normally one) + 1 write, plus
 * 1 lookup by the rules for the list, 1 per read and 2 for the write.
 */
export async function addVehicle(d: string, vehicle: NewVehicle): Promise<string> {
  const used = new Set((await listVehicles(d)).map((stored) => stored.id));
  const free = VEHICLE_SLOT_IDS.filter((slot) => !used.has(slot));
  return guarded(() =>
    runTransaction(db, async (tx) => {
      for (const slot of free) {
        if ((await tx.get(vehicleRef(d, slot))).exists()) continue;
        tx.set(vehicleRef(d, slot), {
          ...vehicle,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        return slot;
      }
      throw new VehicleLimitError(MAX_VEHICLES);
    }),
  );
}

/**
 * Owner or dispatcher, while the distributor is writable: changes a vehicle (`patch` from
 * `prepareVehicleEdit`), or switches it off or back on. Vehicles are never deleted: a shift
 * (phase 5) names them by their slot, and keeps its own copy of the capacity, so this never
 * rewrites a load already approved.
 * Throws `VehicleNotFoundError`, `PermissionDeniedError` or `OfflineError`.
 * Cost: 1 read + 1 write, plus 1 lookup by the rules for the read and 2 for the write.
 */
export function updateVehicle(d: string, vehicleId: string, patch: VehiclePatch): Promise<void> {
  return guarded(() =>
    runTransaction(db, async (tx) => {
      if (!(await tx.get(vehicleRef(d, vehicleId))).exists()) throw new VehicleNotFoundError();
      tx.update(vehicleRef(d, vehicleId), { ...patch, updatedAt: serverTimestamp() });
    }),
  );
}
