// PLAN 3.3: vehicles against the emulators. The seed gives A three (v00 and v01 in use, v02 off)
// and B one.
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { SEED_DISTRIBUTORS, SEED_USERS } from '../../tests/seed/data';
import { seedEmulators } from '../../tests/seed/seed';
import { signInAs } from '../../tests/support/emulated-session';
import { PermissionDeniedError } from '../domain/tenancy/errors';
import { VehicleNotFoundError } from '../domain/vehicles/errors';
import { loadFitsVehicle, vehicleSnapshotOf } from '../domain/vehicles/load';
import { signOutSession } from './auth-repo';
import { addVehicle, listVehicles, updateVehicle } from './vehicles-repo';

const { a: A, b: B } = SEED_DISTRIBUTORS;
const truck = {
  kind: 'truck',
  name: 'Camión 2',
  plate: 'DEM-003',
  capacityCylinders: 80,
  active: true,
} as const;

beforeEach(async () => {
  await signOutSession();
  await seedEmulators();
});

afterAll(async () => {
  await signOutSession();
});

describe('vehicles', () => {
  it('lets the driver read them, in use first', async () => {
    await signInAs(SEED_USERS.driverA);

    const vehicles = await listVehicles(A.id);

    expect(vehicles.map((vehicle) => [vehicle.id, vehicle.active])).toEqual([
      ['v01', true],
      ['v00', true],
      ['v02', false],
    ]);
  });

  it('lets the dispatcher add one in the first free slot and switch it off', async () => {
    await signInAs(SEED_USERS.dispatcherA);

    const id = await addVehicle(A.id, truck);
    expect(id).toBe('v03');
    await updateVehicle(A.id, id, { active: false });

    expect((await listVehicles(A.id)).find((vehicle) => vehicle.id === id)).toMatchObject({
      ...truck,
      active: false,
    });
  });

  it('gives two additions at once two different slots', async () => {
    await signInAs(SEED_USERS.ownerA);

    const ids = await Promise.all([addVehicle(A.id, truck), addVehicle(A.id, truck)]);

    expect(new Set(ids).size).toBe(2);
    expect(await listVehicles(A.id)).toHaveLength(5);
  });

  it('keeps the copy a shift took when the capacity changes (glp-domain §5)', async () => {
    await signInAs(SEED_USERS.ownerA);
    const moto = (await listVehicles(A.id)).find((vehicle) => vehicle.id === 'v00');
    const taken = vehicleSnapshotOf(moto ?? expect.unreachable());
    const load = [{ productId: 'p00', quantity: 3 }];

    await updateVehicle(A.id, 'v00', { capacityCylinders: 2 });

    const now = (await listVehicles(A.id)).find((vehicle) => vehicle.id === 'v00');
    expect(now?.capacityCylinders).toBe(2);
    expect(loadFitsVehicle(load, taken)).toBe(true);
  });

  it('says when the vehicle does not exist', async () => {
    await signInAs(SEED_USERS.ownerA);

    await expect(updateVehicle(A.id, 'v29', { active: false })).rejects.toBeInstanceOf(
      VehicleNotFoundError,
    );
  });

  it('refuses the driver as a writer, and another distributor as a reader', async () => {
    await signInAs(SEED_USERS.driverA);
    await expect(addVehicle(A.id, truck)).rejects.toBeInstanceOf(PermissionDeniedError);
    await expect(updateVehicle(A.id, 'v00', { capacityCylinders: 9 })).rejects.toBeInstanceOf(
      PermissionDeniedError,
    );

    await signInAs(SEED_USERS.ownerB);
    await expect(listVehicles(A.id)).rejects.toBeInstanceOf(PermissionDeniedError);
    expect((await listVehicles(B.id)).map((vehicle) => vehicle.id)).toEqual(['v00']);
  });
});
