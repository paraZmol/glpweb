// PLAN 3.2: helpers against the emulators. The seed gives A two (h00 active, h01 switched off).
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { SEED_DISTRIBUTORS, SEED_USERS } from '../../tests/seed/data';
import { seedEmulators } from '../../tests/seed/seed';
import { signInAs } from '../../tests/support/emulated-session';
import { HelperNotFoundError } from '../domain/staff/errors';
import { PermissionDeniedError } from '../domain/tenancy/errors';
import { signOutSession } from './auth-repo';
import { addHelper, listHelpers, updateHelper } from './helpers-repo';

const { a: A, b: B } = SEED_DISTRIBUTORS;

beforeEach(async () => {
  await signOutSession();
  await seedEmulators();
});

afterAll(async () => {
  await signOutSession();
});

describe('helpers', () => {
  it('lets the driver read them, active first', async () => {
    await signInAs(SEED_USERS.driverA);

    const helpers = await listHelpers(A.id);

    expect(helpers.map((helper) => [helper.id, helper.active])).toEqual([
      ['h00', true],
      ['h01', false],
    ]);
  });

  it('lets the owner add one in the first free slot, rename it and switch it off', async () => {
    await signInAs(SEED_USERS.ownerA);

    const id = await addHelper(A.id, 'R. Ayudante');
    expect(id).toBe('h02');
    await updateHelper(A.id, id, { name: 'R. Ayudante Dos' });
    await updateHelper(A.id, id, { active: false });

    expect((await listHelpers(A.id)).find((helper) => helper.id === id)).toMatchObject({
      name: 'R. Ayudante Dos',
      active: false,
    });
  });

  it('gives two additions at once two different slots', async () => {
    await signInAs(SEED_USERS.ownerA);

    const ids = await Promise.all([addHelper(A.id, 'S. Uno'), addHelper(A.id, 'S. Dos')]);

    expect(new Set(ids).size).toBe(2);
    expect(await listHelpers(A.id)).toHaveLength(4);
  });

  it('says when the helper does not exist', async () => {
    await signInAs(SEED_USERS.ownerA);

    await expect(updateHelper(A.id, 'h29', { active: false })).rejects.toBeInstanceOf(
      HelperNotFoundError,
    );
  });

  it('refuses the driver as a writer, and another distributor as a reader', async () => {
    await signInAs(SEED_USERS.driverA);
    await expect(addHelper(A.id, 'T. Ayudante')).rejects.toBeInstanceOf(PermissionDeniedError);

    await signInAs(SEED_USERS.ownerB);
    await expect(listHelpers(A.id)).rejects.toBeInstanceOf(PermissionDeniedError);
    expect(await listHelpers(B.id)).toEqual([]);
  });
});
