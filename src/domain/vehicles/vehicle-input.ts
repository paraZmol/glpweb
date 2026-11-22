import {
  type Check,
  checkInteger,
  checkVisibleText,
  collectIssues,
  type FieldIssue,
  type Validated,
} from '../tenancy/field-checks';
import {
  MAX_VEHICLE_CAPACITY,
  MIN_VEHICLE_CAPACITY,
  PLATE_MAX_LENGTH,
  PLATE_MIN_LENGTH,
  VEHICLE_NAME_MAX_LENGTH,
} from './constants';
import {
  EDITABLE_VEHICLE_FIELDS,
  type NewVehicle,
  type Vehicle,
  VEHICLE_KINDS,
  type VehicleKind,
  type VehiclePatch,
} from './vehicle';

/** The vehicle form, as typed. */
export interface VehicleInput {
  kind: VehicleKind;
  name: string;
  /** Blank or null for a vehicle without a plate. */
  plate?: string | null;
  capacityCylinders: number;
  /** New vehicles are in use unless the form says otherwise. */
  active?: boolean;
}

const SPACES = /\s+/g;
const tidy = (text: string) => text.trim().replace(SPACES, ' ');

/**
 * Same pattern as isPlate in firebase/firestore.rules: uppercase letters and digits, with at
 * most one hyphen between them ("ABC-123", "1234-AB").
 */
const PLATE = /^[A-Z0-9]+(-[A-Z0-9]+)?$/;

/** "abc 123" → "ABC123", "  a1b-234 " → "A1B-234"; blank → null (no plate). */
export function normalizePlate(raw: string | null | undefined): string | null {
  const plate = (raw ?? '').replace(SPACES, '').toUpperCase();
  return plate === '' ? null : plate;
}

export function checkPlate(plate: string | null): Check {
  if (plate === null) return null;
  if (plate.length < PLATE_MIN_LENGTH) return 'tooShort';
  if (plate.length > PLATE_MAX_LENGTH) return 'tooLong';
  return PLATE.test(plate) ? null : 'invalid';
}

function checkKind(kind: string): Check {
  return (VEHICLE_KINDS as readonly string[]).includes(kind) ? null : 'invalid';
}

function issuesOf(vehicle: NewVehicle): FieldIssue[] {
  return collectIssues([
    ['kind', checkKind(vehicle.kind)],
    ['name', checkVisibleText(vehicle.name, 1, VEHICLE_NAME_MAX_LENGTH)],
    ['plate', checkPlate(vehicle.plate)],
    [
      'capacityCylinders',
      checkInteger(vehicle.capacityCylinders, MIN_VEHICLE_CAPACITY, MAX_VEHICLE_CAPACITY),
    ],
  ]);
}

/** Normalises and validates a new vehicle. firebase/firestore.rules repeats the checks. */
export function prepareNewVehicle(input: VehicleInput): Validated<NewVehicle> {
  const value: NewVehicle = {
    kind: input.kind,
    name: tidy(input.name),
    plate: normalizePlate(input.plate),
    capacityCylinders: input.capacityCylinders,
    active: input.active ?? true,
  };
  const issues = issuesOf(value);
  return issues.length > 0 ? { ok: false, issues } : { ok: true, value };
}

function normalizePatch(patch: VehiclePatch): VehiclePatch {
  const normalized: VehiclePatch = { ...patch };
  if (patch.name !== undefined) normalized.name = tidy(patch.name);
  if (patch.plate !== undefined) normalized.plate = normalizePlate(patch.plate);
  return normalized;
}

/** Only the fields whose value really changes. */
function changedFields(current: Vehicle, patch: VehiclePatch): VehiclePatch {
  const changed: Record<string, unknown> = {};
  for (const field of EDITABLE_VEHICLE_FIELDS) {
    const value = patch[field];
    if (value !== undefined && value !== current[field]) changed[field] = value;
  }
  return changed as VehiclePatch;
}

/**
 * Normalises and validates an edit of `current`, and keeps only what changes. An empty result
 * means nothing changes. A new capacity applies to the shifts declared from then on: shifts
 * keep the copy they took (`vehicleSnapshotOf`).
 */
export function prepareVehicleEdit(current: Vehicle, patch: VehiclePatch): Validated<VehiclePatch> {
  const changes = changedFields(current, normalizePatch(patch));
  const issues = issuesOf({ ...current, ...changes }).filter((issue) => issue.field in changes);
  return issues.length > 0 ? { ok: false, issues } : { ok: true, value: changes };
}
