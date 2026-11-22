import type { Vehicle, VehicleKind } from '../../domain/vehicles/vehicle';
import { MIN_VEHICLE_CAPACITY } from '../../domain/vehicles/constants';
import { prepareNewVehicle, type VehicleInput } from '../../domain/vehicles/vehicle-input';
import { InvalidInputError } from '../../domain/tenancy/errors';
import { describeVehicleError, vehicleFieldMessagesOf } from './vehicle-messages';

/** The vehicle form as typed (PLAN 3.3): the capacity is the text of its field. */
export interface VehicleForm {
  kind: VehicleKind;
  name: string;
  /** Blank for a vehicle without a plate. */
  plate: string;
  capacity: string;
}

export type VehicleFormField = keyof VehicleForm;
export type VehicleFormErrors = Partial<Record<VehicleFormField | 'form', string>>;

const WHOLE_NUMBER = /^\d+$/;
const CAPACITY_FORMAT = 'Escribe cuántos balones lleva, en números enteros, por ejemplo 3.';

/** Domain field → form field, where their names differ. */
const FORM_FIELD: Record<string, VehicleFormField> = { capacityCylinders: 'capacity' };

export function emptyVehicleForm(): VehicleForm {
  return { kind: 'motorcycle', name: '', plate: '', capacity: '' };
}

export function vehicleFormOf(vehicle: Vehicle): VehicleForm {
  return {
    kind: vehicle.kind,
    name: vehicle.name,
    plate: vehicle.plate ?? '',
    capacity: String(vehicle.capacityCylinders),
  };
}

export type ReadVehicleForm =
  { ok: true; input: VehicleInput } | { ok: false; errors: VehicleFormErrors };

/**
 * The typed texts as a vehicle: only the format of the capacity is read here; names, plates and
 * ranges are the domain's (`addVehicle`, `editVehicle`), painted by `vehicleFormErrorsOf`. When
 * the capacity cannot be read, the other fields are checked too, so every missing one shows at
 * once.
 */
export function readVehicleForm(form: VehicleForm): ReadVehicleForm {
  const capacity = form.capacity.trim();
  const input = { kind: form.kind, name: form.name, plate: form.plate };
  if (WHOLE_NUMBER.test(capacity)) {
    return { ok: true, input: { ...input, capacityCylinders: Number(capacity) } };
  }
  const others = prepareNewVehicle({ ...input, capacityCylinders: MIN_VEHICLE_CAPACITY });
  const errors = others.ok ? {} : vehicleFormErrorsOf(new InvalidInputError(others.issues));
  return { ok: false, errors: { ...errors, capacity: CAPACITY_FORMAT } };
}

/** Whatever an add or an edit threw, as messages on the fields (or on the whole form). */
export function vehicleFormErrorsOf(error: unknown): VehicleFormErrors {
  if (!(error instanceof InvalidInputError)) return { form: describeVehicleError(error) };
  const errors: VehicleFormErrors = {};
  for (const [field, message] of Object.entries(vehicleFieldMessagesOf(error))) {
    errors[FORM_FIELD[field] ?? (field as VehicleFormField)] = message;
  }
  return errors;
}
