import { describe, expect, it } from 'vitest';
import { cylindersIn, loadFitsVehicle, vehicleSnapshotOf } from './load';
import type { Vehicle } from './vehicle';

const moto: Vehicle = {
  id: 'v00',
  kind: 'motorcycle',
  name: 'Moto roja',
  plate: 'ABC-123',
  capacityCylinders: 3,
  active: true,
  createdAt: new Date('2026-10-01T12:00:00Z'),
  updatedAt: new Date('2026-10-01T12:00:00Z'),
};

const load = [
  { productId: 'p00', quantity: 2 },
  { productId: 'p02', quantity: 1 },
];

describe('cylindersIn', () => {
  it('adds every line, whatever the weight', () => {
    expect(cylindersIn(load)).toBe(3);
  });

  it('is zero for an empty load', () => {
    expect(cylindersIn([])).toBe(0);
  });
});

describe('loadFitsVehicle', () => {
  it('accepts a load up to the capacity', () => {
    expect(loadFitsVehicle(load, vehicleSnapshotOf(moto))).toBe(true);
  });

  it('rejects one cylinder more than the capacity', () => {
    const heavier = [...load, { productId: 'p01', quantity: 1 }];
    expect(loadFitsVehicle(heavier, vehicleSnapshotOf(moto))).toBe(false);
  });
});

describe('vehicleSnapshotOf (glp-domain §5: a new capacity does not rewrite approved loads)', () => {
  it('keeps the capacity the vehicle had when the shift took it', () => {
    const taken = vehicleSnapshotOf(moto);

    const smaller: Vehicle = { ...moto, capacityCylinders: 1 };

    expect(taken.capacityCylinders).toBe(3);
    expect(loadFitsVehicle(load, taken)).toBe(true);
    expect(loadFitsVehicle(load, vehicleSnapshotOf(smaller))).toBe(false);
  });

  it('copies only what identifies the vehicle and its capacity', () => {
    expect(vehicleSnapshotOf(moto)).toEqual({
      vehicleId: 'v00',
      kind: 'motorcycle',
      name: 'Moto roja',
      plate: 'ABC-123',
      capacityCylinders: 3,
    });
  });
});
