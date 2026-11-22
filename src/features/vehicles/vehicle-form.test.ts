import { describe, expect, it } from 'vitest';
import { InvalidInputError } from '../../domain/tenancy/errors';
import { emptyVehicleForm, readVehicleForm, vehicleFormErrorsOf } from './vehicle-form';

// PLAN 3.3: the vehicle form reads the format of the capacity; the domain decides the rest.
describe('vehicle form', () => {
  it('reads the capacity as whole cylinders', () => {
    const read = readVehicleForm({ ...emptyVehicleForm(), name: 'Moto roja', capacity: ' 3 ' });

    expect(read).toEqual({
      ok: true,
      input: { kind: 'motorcycle', name: 'Moto roja', plate: '', capacityCylinders: 3 },
    });
  });

  it('refuses a capacity that is not a whole number', () => {
    const read = readVehicleForm({ ...emptyVehicleForm(), name: 'Moto roja', capacity: '2.5' });

    expect(read).toEqual({
      ok: false,
      errors: { capacity: 'Escribe cuántos balones lleva, en números enteros, por ejemplo 3.' },
    });
  });

  it('points at every missing field at once, not one after the other', () => {
    const read = readVehicleForm(emptyVehicleForm());

    expect(read).toEqual({
      ok: false,
      errors: {
        name: 'Escribe un nombre para reconocerlo, por ejemplo "Moto roja".',
        capacity: 'Escribe cuántos balones lleva, en números enteros, por ejemplo 3.',
      },
    });
  });

  it('paints the capacity refused by the domain on its own field', () => {
    const error = new InvalidInputError([{ field: 'capacityCylinders', code: 'outOfRange' }]);

    expect(vehicleFormErrorsOf(error)).toEqual({
      capacity: 'Escribe cuántos balones lleva, de 1 a 999.',
    });
  });
});
