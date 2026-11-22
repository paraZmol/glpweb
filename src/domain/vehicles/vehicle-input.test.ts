import { describe, expect, it } from 'vitest';
import { MAX_VEHICLE_CAPACITY, PLATE_MAX_LENGTH, VEHICLE_NAME_MAX_LENGTH } from './constants';
import type { Vehicle } from './vehicle';
import {
  normalizePlate,
  prepareNewVehicle,
  prepareVehicleEdit,
  type VehicleInput,
} from './vehicle-input';

const input = (change: Partial<VehicleInput> = {}): VehicleInput => ({
  kind: 'motorcycle',
  name: 'Moto roja',
  plate: 'abc-123',
  capacityCylinders: 3,
  ...change,
});

const stored: Vehicle = {
  id: 'v00',
  kind: 'motorcycle',
  name: 'Moto roja',
  plate: 'ABC-123',
  capacityCylinders: 3,
  active: true,
  createdAt: new Date('2026-10-01T12:00:00Z'),
  updatedAt: new Date('2026-10-01T12:00:00Z'),
};

describe('normalizePlate', () => {
  it.each([
    ['abc 123', 'ABC123'],
    ['  a1b-234 ', 'A1B-234'],
    ['', null],
    ['   ', null],
    [null, null],
  ])('%j → %j', (raw, expected) => {
    expect(normalizePlate(raw)).toBe(expected);
  });
});

describe('prepareNewVehicle', () => {
  it('normalises the name and the plate, in use by default', () => {
    expect(prepareNewVehicle(input({ name: '  Moto   roja ' }))).toEqual({
      ok: true,
      value: {
        kind: 'motorcycle',
        name: 'Moto roja',
        plate: 'ABC-123',
        capacityCylinders: 3,
        active: true,
      },
    });
  });

  it('accepts a vehicle without a plate', () => {
    const prepared = prepareNewVehicle(input({ plate: '' }));
    expect(prepared.ok && prepared.value.plate).toBeNull();
  });

  it('accepts the largest capacity, for a truck', () => {
    expect(prepareNewVehicle(input({ kind: 'truck', capacityCylinders: 999 })).ok).toBe(true);
  });

  it.each([
    ['an unknown kind', { kind: 'bus' as never }, 'kind', 'invalid'],
    ['an empty name', { name: '  ' }, 'name', 'required'],
    ['a name too long', { name: 'n'.repeat(VEHICLE_NAME_MAX_LENGTH + 1) }, 'name', 'tooLong'],
    ['a name of punctuation', { name: '--' }, 'name', 'invalid'],
    ['a name with a zero-width space', { name: 'Moto​roja' }, 'name', 'invalid'],
    ['a plate too short', { plate: 'AB' }, 'plate', 'tooShort'],
    ['a plate too long', { plate: 'A'.repeat(PLATE_MAX_LENGTH + 1) }, 'plate', 'tooLong'],
    ['a plate with two hyphens', { plate: 'A-B-C' }, 'plate', 'invalid'],
    ['a plate with an accent', { plate: 'ÑAB-123' }, 'plate', 'invalid'],
    ['a plate that starts with a hyphen', { plate: '-AB123' }, 'plate', 'invalid'],
    ['no capacity', { capacityCylinders: 0 }, 'capacityCylinders', 'outOfRange'],
    ['a negative capacity', { capacityCylinders: -3 }, 'capacityCylinders', 'outOfRange'],
    [
      'a capacity above the cap',
      { capacityCylinders: MAX_VEHICLE_CAPACITY + 1 },
      'capacityCylinders',
      'outOfRange',
    ],
    ['half a cylinder', { capacityCylinders: 2.5 }, 'capacityCylinders', 'invalid'],
    ['a capacity that is not a number', { capacityCylinders: NaN }, 'capacityCylinders', 'invalid'],
  ])('rejects %s', (_case, change, field, code) => {
    expect(prepareNewVehicle(input(change))).toEqual({ ok: false, issues: [{ field, code }] });
  });
});

describe('prepareVehicleEdit', () => {
  it('keeps only what changes', () => {
    expect(
      prepareVehicleEdit(stored, { name: 'Moto roja', plate: 'abc-123', capacityCylinders: 4 }),
    ).toEqual({ ok: true, value: { capacityCylinders: 4 } });
  });

  it('gives nothing when nothing changes', () => {
    expect(prepareVehicleEdit(stored, { active: true })).toEqual({ ok: true, value: {} });
  });

  it('can take the plate away', () => {
    expect(prepareVehicleEdit(stored, { plate: ' ' })).toEqual({
      ok: true,
      value: { plate: null },
    });
  });

  it('reports only the fields of the edit', () => {
    expect(prepareVehicleEdit(stored, { capacityCylinders: 0 })).toEqual({
      ok: false,
      issues: [{ field: 'capacityCylinders', code: 'outOfRange' }],
    });
  });
});
