// role-walker
// Fifth pass, 2026-11-15 (docs/testing/matriz-de-roles.md, §4b): what a person found in the
// first minutes of using /central/vehiculos (PLAN 3.3), as titular, central and driver, at 390 and 1440 px. Each test
// describes what a person expects; the ones the app does not do yet are marked with `knownBug`
// (a `test.fail` with the reason): the day the app is fixed the test turns "unexpectedly
// passing" and the mark is removed. Every test works on a distributor of its own
// (`tests/e2e/support/plant-walk.ts`), never on seeded A.
import { expect, type Page } from '@playwright/test';
import { PHONE, runOncePerActorDevices, test } from '../support/actors';
import { readDocument, uniqueTag, writeDocument } from '../support/emulator-admin';
import type { OwnDistributor } from '../support/own-distributor';
import { DAY_MS, openAs, plant } from '../support/plant-walk';
import { signInAs } from '../support/sign-in';

test.skip(
  process.env.E2E_EMULATORS !== 'true',
  'Needs the seeded emulators: run with E2E_EMULATORS=true',
);
test.slow();

// ---------------------------------------------------------------------------- vehicles ---

test.describe('vehicles', () => {
  test.skip(({ isMobile }) => !isMobile, 'What a phone shows: runs under the phone project');

  async function vehicles(page: Page, own: OwnDistributor) {
    await signInAs(page, own.person('central'), '/central');
    await page.goto('/central/vehiculos');
  }

  test('saving an empty vehicle points at every field that is missing', async ({
    page,
  }, testInfo) => {
    await vehicles(page, await plant(uniqueTag(testInfo)));
    await page.getByRole('button', { name: 'Añadir vehículo' }).click();
    await page.getByRole('button', { name: 'Guardar vehículo' }).click();
    await expect(page.getByText(/Escribe un nombre para reconocerlo/)).toBeVisible();
    await expect(page.getByText(/Escribe cuántos balones lleva/)).toBeVisible();
  });

  test('"Atrás" with the vehicle form open closes it and stays on the vehicles', async ({
    page,
  }, testInfo) => {
    await vehicles(page, await plant(uniqueTag(testInfo)));
    await page.getByRole('button', { name: 'Añadir vehículo' }).click();
    await page.getByLabel('Nombre').fill('Moto nueva');
    await page.goBack();
    await expect(page).toHaveURL(/\/central\/vehiculos$/);
  });

  test('a double click on "Guardar vehículo" does not select text of the bar', async ({
    page,
  }, testInfo) => {
    await vehicles(page, await plant(uniqueTag(testInfo)));
    await page.getByRole('button', { name: 'Añadir vehículo' }).click();
    await page.getByLabel('Nombre').fill('Doble');
    await page.getByLabel('¿Cuántos balones lleva?').fill('2');
    await page.getByRole('button', { name: 'Guardar vehículo' }).dblclick();
    await expect(page.getByText('Añadimos Doble.')).toBeVisible();
    expect(await page.evaluate(() => window.getSelection()?.toString() ?? '')).toBe('');
  });
});

test.describe('vehicles, suspension in the middle', () => {
  runOncePerActorDevices();

  test('what was typed in a vehicle is not lost without a word when the distributor turns read-only', async ({
    actors,
  }, testInfo) => {
    const own = await plant(uniqueTag(testInfo));
    const central = await openAs(actors, own, 'central', PHONE);
    await central.page.goto('/central/vehiculos');
    await central.page.getByRole('button', { name: 'Añadir vehículo' }).click();
    await central.page.getByLabel('Nombre').fill('Moto en suspensión');
    const control = (await readDocument(`distributors/${own.id}/private/control`)) ?? {};
    await writeDocument(`distributors/${own.id}/private/control`, {
      ...control,
      status: 'suspended',
      trialEndsAt: new Date(Date.now() - DAY_MS),
      approvedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await expect(central.page.getByText(/suspendió tu distribuidora/)).toBeVisible();
    await expect(
      central.page.getByText(/Moto en suspensión|mientras (editabas|escribías)/).first(),
    ).toBeVisible();
    // The central itself should not read that "the central" registers the vehicles.
    await expect(central.page.getByText(/los registran el titular o la central/)).toHaveCount(0);
  });
});
