// role-walker
// Fifth pass, 2026-11-15 (docs/testing/matriz-de-roles.md, §4b): what a person found in the
// first minutes of using /central/promociones (PLAN 3.5), as titular, central and driver, at 390 and 1440 px. Each test
// describes what a person expects; the ones the app does not do yet are marked with `knownBug`
// (a `test.fail` with the reason): the day the app is fixed the test turns "unexpectedly
// passing" and the mark is removed. Every test works on a distributor of its own
// (`tests/e2e/support/plant-walk.ts`), never on seeded A.
import { expect, type Page } from '@playwright/test';
import { DESKTOP, PHONE, runOncePerActorDevices, test } from '../support/actors';
import { readDocument, uniqueTag } from '../support/emulator-admin';
import { knownBug } from '../support/flow-helpers';
import type { OwnDistributor } from '../support/own-distributor';
import { openAs, plant } from '../support/plant-walk';
import { signInAs } from '../support/sign-in';

test.skip(
  process.env.E2E_EMULATORS !== 'true',
  'Needs the seeded emulators: run with E2E_EMULATORS=true',
);
test.slow();

// -------------------------------------------------------------------------- promotions ---

test.describe('promotions', () => {
  test.skip(({ isMobile }) => !isMobile, 'What a phone shows: runs under the phone project');

  async function newAmountOff(page: Page, own: OwnDistributor) {
    await signInAs(page, own.founder, '/central');
    await page.goto('/central/promociones');
    await page.getByRole('button', { name: 'Añadir promoción' }).click();
    await page.getByRole('button', { name: /^S\/ menos/ }).click();
  }

  test('a rebate bigger than the price is refused before publishing, never shown as a negative price', async ({
    page,
  }, testInfo) => {
    knownBug(
      'S/ 60 off a S/ 48 refill: the preview shows "-S/ 12.00", "Ahorras S/ 60.00", "125 %" and offers ' +
        '"Entiendo y quiero publicarla"; the refusal only appears after "Publicar promoción"',
    );
    await newAmountOff(page, await plant(uniqueTag(testInfo)));
    await page.getByRole('radio', { name: 'Otro' }).click();
    await page.getByLabel('Soles de rebaja').fill('60');
    await expect(page.getByText(/-S\/\s?\d/)).toHaveCount(0);
    await expect(page.getByText(/no puede ser igual o mayor que el precio/)).toBeVisible();
    await expect(page.getByRole('checkbox', { name: 'Entiendo y quiero publicarla' })).toHaveCount(
      0,
    );
  });

  test('a rebate of 0 says what is allowed', async ({ page }, testInfo) => {
    knownBug('"Otro" with 0 answers "Está fuera del rango permitido." without saying which range');
    await newAmountOff(page, await plant(uniqueTag(testInfo)));
    await page.getByRole('radio', { name: 'Otro' }).click();
    await page.getByLabel('Soles de rebaja').fill('0');
    await page.getByRole('button', { name: 'Publicar promoción' }).click();
    await expect(page.getByLabel('Soles de rebaja')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByText('Está fuera del rango permitido.')).toHaveCount(0);
  });

  test('publishing without a product shows why, where the person is looking', async ({
    page,
  }, testInfo) => {
    knownBug(
      'The error "Elige al menos un producto." appears far above; the page does not move and nothing seems to happen',
    );
    await newAmountOff(page, await plant(uniqueTag(testInfo)));
    await page.getByRole('checkbox', { name: /Marca Uno/ }).click();
    await page.getByRole('button', { name: 'Publicar promoción' }).click();
    await expect(page.getByText('Elige al menos un producto.')).toBeInViewport();
  });

  test('"Atrás" with the promotion form open closes it and stays on the promotions', async ({
    page,
  }, testInfo) => {
    knownBug(
      '"Atrás" with the form open leaves for /central and what was typed is lost (in the catalogue, "Atrás" closes the form)',
    );
    await newAmountOff(page, await plant(uniqueTag(testInfo)));
    await page.getByLabel('Nombre').fill('Escrito y atrás');
    await page.goBack();
    await expect(page).toHaveURL(/\/central\/promociones$/);
  });
});

test.describe('promotions, two people', () => {
  runOncePerActorDevices();

  test('two people turning off the same promotion at once: neither reads "no permission"', async ({
    actors,
  }, testInfo) => {
    knownBug(
      'The second person reads "No tienes permiso para hacer esto, o la distribuidora está en solo lectura."',
    );
    const own = await plant(uniqueTag(testInfo));
    const titular = await openAs(actors, own, 'titular', DESKTOP);
    const central = await openAs(actors, own, 'central', PHONE);
    for (const { page } of [titular, central]) {
      await page.goto('/central/promociones');
      await page
        .getByRole('button', { name: /Apagar/ })
        .first()
        .click();
      await expect(page.getByRole('button', { name: 'Sí, apagarla' })).toBeVisible();
    }
    // Both answer at the same moment, as two people at the counter would.
    await Promise.all([
      titular.page.getByRole('button', { name: 'Sí, apagarla' }).click(),
      central.page.getByRole('button', { name: 'Sí, apagarla' }).click(),
    ]);
    await expect
      .poll(async () => (await readDocument(`distributors/${own.id}/promotions/o00`))?.active)
      .toBe(false);
    for (const { page } of [titular, central]) {
      await expect(page.getByText('Apagada', { exact: true })).toBeVisible();
      await page.waitForTimeout(1_000);
      expect(await page.getByText(/No tienes permiso/).count()).toBe(0);
    }
  });
});
