import * as vehiclesRepo from '../../data/vehicles-repo';
import { InvalidInputError, NothingChangedError } from '../../domain/tenancy/errors';
import type { Vehicle, VehiclePatch } from '../../domain/vehicles/vehicle';
import {
  prepareNewVehicle,
  prepareVehicleEdit,
  type VehicleInput,
} from '../../domain/vehicles/vehicle-input';

/**
 * Owner or dispatcher (PLAN 3.3; §11, 2026-10-16, decided by the user): adds a vehicle, in use unless
 * `input.active` is false. The plate is stored in uppercase without spaces, or null. The rules
 * cannot keep plates unique: warn first with `plateInUse(vehicles, normalizePlate(typed))`.
 * Returns its id. Throws `InvalidInputError` (per field: `kind`, `name`, `plate`,
 * `capacityCylinders`), `VehicleLimitError`, `PermissionDeniedError` (a driver or someone
 * outside, or the distributor is read-only) or `OfflineError`.
 */
export function addVehicle(distributorId: string, input: VehicleInput): Promise<string> {
  const prepared = prepareNewVehicle(input);
  if (!prepared.ok) return Promise.reject(new InvalidInputError(prepared.issues));
  return vehiclesRepo.addVehicle(distributorId, prepared.value);
}

/**
 * Owner or dispatcher: edits `current` (as the screen has it) with `patch`. A new capacity
 * applies to shifts declared from then on; shifts already approved keep theirs.
 * Throws `InvalidInputError`, `NothingChangedError` (nothing was written),
 * `VehicleNotFoundError`, `PermissionDeniedError` or `OfflineError`.
 */
export function editVehicle(
  distributorId: string,
  current: Vehicle,
  patch: VehiclePatch,
): Promise<void> {
  const prepared = prepareVehicleEdit(current, patch);
  if (!prepared.ok) return Promise.reject(new InvalidInputError(prepared.issues));
  if (Object.keys(prepared.value).length === 0) return Promise.reject(new NothingChangedError());
  return vehiclesRepo.updateVehicle(distributorId, current.id, prepared.value);
}

/** Owner or dispatcher: takes a vehicle out of use (it is no longer offered) or back. */
export function setVehicleActive(
  distributorId: string,
  vehicle: Vehicle,
  isActive: boolean,
): Promise<void> {
  return editVehicle(distributorId, vehicle, { active: isActive });
}
