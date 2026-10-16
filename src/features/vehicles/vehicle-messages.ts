import {
  MAX_VEHICLE_CAPACITY,
  MIN_VEHICLE_CAPACITY,
  PLATE_MAX_LENGTH,
  PLATE_MIN_LENGTH,
  VEHICLE_NAME_MAX_LENGTH,
} from '../../domain/vehicles/constants';
import { VehicleLimitError, VehicleNotFoundError } from '../../domain/vehicles/errors';
import type { VehicleKind } from '../../domain/vehicles/vehicle';
import { InvalidInputError, NothingChangedError } from '../../domain/tenancy/errors';
import type { FieldIssue } from '../../domain/tenancy/field-checks';
import { describeFieldIssue, describeTenancyError } from '../tenancy/tenancy-messages';

/** How each kind is called on screen. */
export const VEHICLE_KIND_LABELS: Record<VehicleKind, string> = {
  motorcycle: 'Moto',
  tricycle: 'Trimoto',
  truck: 'Camión o camioneta',
};

const CAPACITY_RANGE = `Escribe cuántos balones lleva, de ${MIN_VEHICLE_CAPACITY} a ${MAX_VEHICLE_CAPACITY}.`;

const VEHICLE_MESSAGES: Record<string, string> = {
  'kind:invalid': 'Elige el tipo de vehículo.',
  'name:required': 'Escribe un nombre para reconocerlo, por ejemplo "Moto roja".',
  'name:tooLong': `El nombre admite hasta ${VEHICLE_NAME_MAX_LENGTH} caracteres.`,
  'name:invalid': 'Escribe el nombre con letras o números, sin caracteres invisibles.',
  'plate:tooShort': `La placa necesita al menos ${PLATE_MIN_LENGTH} letras o números.`,
  'plate:tooLong': `La placa admite hasta ${PLATE_MAX_LENGTH} caracteres.`,
  'plate:invalid': 'Escribe la placa con letras y números, por ejemplo ABC-123.',
  'capacityCylinders:outOfRange': CAPACITY_RANGE,
  'capacityCylinders:invalid': 'Escribe la capacidad en balones enteros, por ejemplo 3.',
};

/** Message in Spanish for one rejected field of the vehicle form. */
export function describeVehicleIssue(issue: FieldIssue): string {
  return VEHICLE_MESSAGES[`${issue.field}:${issue.code}`] ?? describeFieldIssue(issue);
}

/** Field name → message, to paint the vehicle form after an `InvalidInputError`. */
export function vehicleFieldMessagesOf(error: unknown): Record<string, string> {
  if (!(error instanceof InvalidInputError)) return {};
  return Object.fromEntries(
    error.issues.map((issue) => [issue.field, describeVehicleIssue(issue)]),
  );
}

/** The warning before saving a plate another vehicle already carries (`plateInUse`). */
export const PLATE_IN_USE_WARNING = 'Otro de tus vehículos ya tiene esa placa. Revísala.';

/** Message in Spanish for anything a vehicle action can throw. */
export function describeVehicleError(error: unknown): string {
  if (error instanceof VehicleLimitError) {
    return `Puedes tener hasta ${error.limit} vehículos, también los que no están en uso.`;
  }
  if (error instanceof VehicleNotFoundError) {
    return 'Ese vehículo ya no está en tu lista. Vuelve a cargarla.';
  }
  if (error instanceof NothingChangedError) return 'No cambiaste nada.';
  return describeTenancyError(error);
}
