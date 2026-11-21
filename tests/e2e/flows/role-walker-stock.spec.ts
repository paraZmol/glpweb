// role-walker
// Fifth pass, 2026-11-15 (docs/testing/matriz-de-roles.md, §4b): what a person found in the
// first minutes of using /central/stock (PLAN 3.4) and its place in the grouped phone bar
// ("Planta"), as titular, central and driver, at 390 and 1440 px. The group "holds" is what was
// right and must stay right: the driver has no stock, in the screen and against the rules, and
// another distributor gets nothing. Each test describes what a person expects; the ones the app does not do yet are marked with `knownBug`
// (a `test.fail` with the reason): the day the app is fixed the test turns "unexpectedly
// passing" and the mark is removed. Every test works on a distributor of its own
// (`tests/e2e/support/plant-walk.ts`), never on seeded A.
import { expect, type Page } from '@playwright/test';
import { SEED_USERS } from '../../seed/data';
import { DESKTOP, PHONE, runOncePerActorDevices, test } from '../support/actors';
import { readDocument, uniqueTag } from '../support/emulator-admin';
import type { OwnDistributor } from '../support/own-distributor';
import { DENIED, directPatch, directRead, OK, openAs, plant, tokenOf } from '../support/plant-walk';
import { signInAs } from '../support/sign-in';

test.skip(
  process.env.E2E_EMULATORS !== 'true',
  'Needs the seeded emulators: run with E2E_EMULATORS=true',
);
test.slow();

// ------------------------------------------------------------------------------- holds ---

test.describe('holds', () => {
  runOncePerActorDevices();

  test('the driver has no Planta, and the rules refuse the plant stock to him and to another distributor', async ({
    actors,
  }, testInfo) => {
    const own = await plant(uniqueTag(testInfo));
    const driver = await openAs(actors, own, 'reparto', PHONE);
    const bar = driver.page.getByRole('navigation', { name: 'Principal' });
    await expect(bar.getByRole('link', { name: 'Vehículos' })).toBeVisible();
    await expect(bar.getByRole('link', { name: /Planta|Stock/ })).toHaveCount(0);
    await driver.page.goto('/central/stock');
    await expect(driver.page).toHaveURL(/\/reparto$/);
    await expect(
      driver.page.getByText('Esa sección no está disponible para tu cuenta.'),
    ).toBeVisible();
    await driver.page.goto('/reparto/stock');
    await expect(driver.page.getByRole('heading', { level: 1 })).toHaveText(
      'Esta página no existe.',
    );

    const token = await tokenOf(driver.page);
    expect(await directRead(token, own.id, 'vehicles', 30)).toBe(OK);
    expect(await directRead(token, own.id, 'promotions', 20)).toBe(OK);
    expect(await directRead(token, own.id, 'plantStock/p00')).toBe(DENIED);
    expect(await directRead(token, own.id, 'plantStock', 30)).toBe(DENIED);
    expect(await directRead(token, own.id, 'stockMovements', 50)).toBe(DENIED);
    expect(
      await directPatch(token, `distributors/${own.id}/vehicles/v00`, {
        name: { stringValue: 'Otra' },
      }),
    ).toBe(DENIED);
    expect(
      await directPatch(token, `distributors/${own.id}/promotions/o00`, {
        title: { stringValue: 'Otra' },
      }),
    ).toBe(DENIED);

    // The owner of another distributor sees his own screens and gets nothing of this one.
    const other = await actors.open(DESKTOP);
    await signInAs(other.page, SEED_USERS.ownerB, '/central');
    await other.page.goto('/central/vehiculos');
    await expect(other.page.getByRole('heading', { name: 'Moto azul' })).toBeVisible();
    await expect(other.page.getByText('RWK-001')).toHaveCount(0);
    const otherToken = await tokenOf(other.page);
    expect(await directRead(otherToken, own.id, 'vehicles', 30)).toBe(DENIED);
    expect(await directRead(otherToken, own.id, 'plantStock', 30)).toBe(DENIED);
    expect(await directRead(otherToken, own.id, 'promotions', 20)).toBe(DENIED);
    expect(
      await directPatch(otherToken, `distributors/${own.id}/plantStock/p00`, {
        full: { integerValue: '999' },
      }),
    ).toBe(DENIED);
  });
});

// ------------------------------------------------------------------------- plant stock ---

test.describe('plant stock', () => {
  runOncePerActorDevices();

  test('a physical count saves the total the person counted, also when the screen was behind', async ({
    actors,
  }, testInfo) => {
    const own = await plant(uniqueTag(testInfo));
    const central = await openAs(actors, own, 'central', PHONE);
    const titular = await openAs(actors, own, 'titular', DESKTOP);
    await central.page.goto('/central/stock');
    await central.page.getByRole('button', { name: /Ajustar/ }).click();
    await expect(central.page.getByText(/Hoy figuran 40 llenos/)).toBeVisible();

    await titular.page.goto('/central/stock');
    await titular.page.getByRole('button', { name: /Ajustar/ }).click();
    await titular.page.getByRole('radio', { name: /Proveedor/ }).click();
    await titular.page.getByLabel('Llenos que llegaron').fill('10');
    await titular.page.getByRole('button', { name: 'Guardar ajuste' }).click();
    await expect
      .poll(async () => (await readDocument(`distributors/${own.id}/plantStock/p00`))?.full)
      .toBe(50);

    await central.page.getByLabel('Llenos contados').fill('38');
    await central.page.getByRole('button', { name: 'Guardar ajuste' }).click();
    // Either the count wins (38) or the screen stops the person to count again (50 stays): the
    // stock is read once the screen has said which of the two happened.
    await expect(
      central.page.getByText(/Ajustamos el stock de|El stock cambió mientras contabas/),
    ).toBeVisible();
    const full = (await readDocument(`distributors/${own.id}/plantStock/p00`))?.full;
    expect([38, 50]).toContain(full);
  });
});

test.describe('plant stock, one person', () => {
  test.skip(({ isMobile }) => !isMobile, 'What a phone shows: runs under the phone project');

  async function adjustForm(page: Page, own: OwnDistributor) {
    await signInAs(page, own.person('central'), '/central');
    await page.goto('/central/stock');
    await page.getByRole('button', { name: /Ajustar/ }).click();
  }

  test('"Ajustar" stays inside its card at 390 px', async ({ page }, testInfo) => {
    const own = await plant(uniqueTag(testInfo));
    await signInAs(page, own.person('central'), '/central');
    await page.goto('/central/stock');
    const button = page.getByRole('button', { name: /Ajustar/ });
    const card = page
      .locator('main section, main [class*="rounded"]')
      .filter({ has: page.getByText('Por producto') })
      .last();
    const buttonBox = await button.boundingBox();
    const cardBox = await card.boundingBox();
    expect(buttonBox && cardBox).toBeTruthy();
    expect(buttonBox!.x + buttonBox!.width).toBeLessThanOrEqual(cardBox!.x + cardBox!.width);
  });

  test('a count too big says it is too big, not "below zero"', async ({ page }, testInfo) => {
    await adjustForm(page, await plant(uniqueTag(testInfo)));
    await page.getByLabel('Llenos contados').fill('999999');
    await page.getByRole('button', { name: 'Guardar ajuste' }).click();
    await expect(page.getByText(/hasta 9999 de una vez/)).toBeVisible();
    await expect(page.getByText(/por debajo de cero/)).toHaveCount(0);
  });

  test('taking out more than there is says so once', async ({ page }, testInfo) => {
    await adjustForm(page, await plant(uniqueTag(testInfo)));
    await page.getByRole('radio', { name: /Dañado/ }).click();
    await page.getByLabel('Llenos que salen').fill('50');
    await page.getByRole('button', { name: 'Guardar ajuste' }).click();
    await expect(page.getByText(/por debajo de cero/).first()).toBeVisible();
    // A save that went to the server would hold "Cancelar" until it answered, and its answer
    // would say it a second time: once the form is idle, the count is final.
    await expect(page.getByRole('button', { name: 'Cancelar' })).toBeEnabled();
    expect(await page.getByText(/por debajo de cero/).count()).toBe(1);
  });

  test('one full cylinder is "1 lleno"', async ({ page }, testInfo) => {
    await adjustForm(page, await plant(uniqueTag(testInfo)));
    await page.getByLabel('Llenos contados').fill('1');
    await expect(page.getByText(/Quedan 1 lleno\b/)).toBeVisible();
  });

  test('the log names the supplier movement the way the form does', async ({ page }, testInfo) => {
    await adjustForm(page, await plant(uniqueTag(testInfo)));
    await page.getByRole('radio', { name: /Proveedor/ }).click();
    await page.getByLabel('Llenos que llegaron').fill('2');
    await page.getByRole('button', { name: 'Guardar ajuste' }).click();
    await expect(page.getByText(/Proveedor: llegaron llenos o se llevaron vacíos/)).toBeVisible();
  });

  test('"Atrás" with the adjustment open closes it and stays on the stock', async ({
    page,
  }, testInfo) => {
    await adjustForm(page, await plant(uniqueTag(testInfo)));
    await page.getByLabel('Llenos contados').fill('11');
    await page.goBack();
    await expect(page).toHaveURL(/\/central\/stock$/);
    await expect(page.getByRole('button', { name: 'Guardar ajuste' })).toHaveCount(0);
  });
});
