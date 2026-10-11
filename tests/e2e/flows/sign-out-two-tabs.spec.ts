import { expect, test } from '@playwright/test';
import { SEED_DISTRIBUTORS } from '../../seed/data';
import {
  appStorageKeys,
  deviceStorageDump,
  expectDeviceCleared,
  FIRESTORE_CACHE_DB,
} from '../support/device-storage';
import { readDocument } from '../support/emulator-admin';
import { signInAsSeedUser } from '../support/sign-in';
import { dismissStorageNotice } from '../support/storage-notice';

test.skip(
  process.env.E2E_EMULATORS !== 'true',
  'Needs the seeded emulators: run with E2E_EMULATORS=true',
);

const { a } = SEED_DISTRIBUTORS;

// PLAN 2.9: signing out leaves nothing of the account on the device, also in the other tabs.
test('signing out in one tab ends the session and wipes the device in both', async ({
  context,
}) => {
  const errors: string[] = [];
  context.on('weberror', (webError) => errors.push(webError.error().message));
  await dismissStorageNotice(context);
  const first = await context.newPage();
  const owner = await signInAsSeedUser(first, 'ownerA');
  await expect(first.getByRole('heading', { level: 1 })).toContainText(a.name);
  const second = await context.newPage();
  await second.goto('/cuenta');
  await expect(second.getByRole('button', { name: 'Cerrar sesión' })).toBeVisible();
  // What a session leaves behind: the chosen distributor, the session mark and the data cache.
  await first.evaluate(
    ([uid, distributorId]) =>
      localStorage.setItem(`hornilla.currentDistributor.${uid}`, distributorId),
    [owner.uid, a.id] as const,
  );
  expect(await deviceStorageDump(first, FIRESTORE_CACHE_DB)).toContain(owner.displayName);
  expect(await appStorageKeys(first)).toContain('hornilla.localData');

  await first.goto('/cuenta');
  await first.getByRole('button', { name: 'Cerrar sesión' }).click();

  // The tab that signed out goes to the public home; the other one is asked to sign in.
  await expect(first).toHaveURL(/\/$/);
  await expect(first.getByRole('banner').getByRole('link', { name: 'Ingresar' })).toBeVisible();
  await expect(second).toHaveURL(/\/ingresar/);
  await expect(second.getByRole('button', { name: 'Ingresar', exact: true })).toBeVisible();
  await expectDeviceCleared(first);
  await expectDeviceCleared(second);
  const cache = await deviceStorageDump(first, FIRESTORE_CACHE_DB);
  expect(cache).not.toContain(owner.displayName);
  expect(cache).not.toContain(owner.phone);
  // Nothing was lost on the server: only the copy on the device is gone.
  expect(await readDocument(`users/${owner.uid}`)).toMatchObject({
    displayName: owner.displayName,
  });
  expect(errors).toEqual([]);

  // The app still works after the wipe: the same tab signs in again and reads its data.
  await signInAsSeedUser(first, 'ownerA');
  await expect(first.getByRole('heading', { level: 1 })).toContainText(a.name);
  expect(errors).toEqual([]);
});
