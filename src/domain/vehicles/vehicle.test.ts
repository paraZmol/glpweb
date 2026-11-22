import { describe, expect, it } from 'vitest';
import { MAX_VEHICLES } from './constants';
import { canEditVehicles } from './permissions';
import { freeVehicleSlot, plateInUse, sortVehicles, VEHICLE_SLOT_IDS } from './vehicle';

describe('vehicle slots', () => {
  it(`are v00 … v${MAX_VEHICLES - 1}, the pattern of the rules`, () => {
    expect(VEHICLE_SLOT_IDS).toHaveLength(MAX_VEHICLES);
    expect(VEHICLE_SLOT_IDS.every((slot) => /^v[0-2][0-9]$/.test(slot))).toBe(true);
  });

  it('gives the first free slot, a gap included', () => {
    expect(freeVehicleSlot([])).toBe('v00');
    expect(freeVehicleSlot([{ id: 'v00' }, { id: 'v02' }])).toBe('v01');
  });

  it('gives null when every slot is taken', () => {
    expect(freeVehicleSlot(VEHICLE_SLOT_IDS.map((id) => ({ id })))).toBeNull();
  });
});

describe('sortVehicles', () => {
  it('puts vehicles in use first, then by name', () => {
    const sorted = sortVehicles([
      { id: 'v00', name: 'Moto roja', active: true },
      { id: 'v01', name: 'Camión 1', active: false },
      { id: 'v02', name: 'Camión 2', active: true },
    ]);
    expect(sorted.map((vehicle) => vehicle.id)).toEqual(['v02', 'v00', 'v01']);
  });
});

describe('plateInUse', () => {
  const fleet = [
    { id: 'v00', plate: 'ABC-123' },
    { id: 'v01', plate: null },
  ];

  it('finds a plate another vehicle carries', () => {
    expect(plateInUse(fleet, 'ABC-123')).toBe(true);
  });

  it('does not count the vehicle being edited', () => {
    expect(plateInUse(fleet, 'ABC-123', 'v00')).toBe(false);
  });

  it('never counts a missing plate as repeated', () => {
    expect(plateInUse(fleet, null)).toBe(false);
  });
});

describe('canEditVehicles (PLAN §11, 2026-10-16)', () => {
  it.each([
    ['owner', true],
    ['dispatcher', true],
    ['driver', false],
  ] as const)('%s → %s', (role, expected) => {
    expect(canEditVehicles(role)).toBe(expected);
  });
});
