import { describe, expect, it } from 'vitest';
import { InvalidInputError } from '../../domain/tenancy/errors';
import { VehicleLimitError } from '../../domain/vehicles/errors';
import { prepareNewVehicle } from '../../domain/vehicles/vehicle-input';
import { describeVehicleError, vehicleFieldMessagesOf } from './vehicle-messages';

describe('vehicle messages', () => {
  it('paints every rejected field of the form', () => {
    const prepared = prepareNewVehicle({
      kind: 'motorcycle',
      name: '',
      plate: 'A-B-C',
      capacityCylinders: 0,
    });
    const error = new InvalidInputError(prepared.ok ? [] : prepared.issues);

    expect(vehicleFieldMessagesOf(error)).toEqual({
      name: 'Escribe un nombre para reconocerlo, por ejemplo "Moto roja".',
      plate: 'Escribe la placa con letras y números, por ejemplo ABC-123.',
      capacityCylinders: 'Escribe cuántos balones lleva, de 1 a 999.',
    });
  });

  it('explains the cap of vehicles', () => {
    expect(describeVehicleError(new VehicleLimitError(30))).toBe(
      'Puedes tener hasta 30 vehículos, también los que no están en uso.',
    );
  });
});
