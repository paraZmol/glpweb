// PLAN 2.2. The steps of the sign-up of a distributor are entries of the browser history
// (role-walker, 2026-10-11: the back button, or the back gesture of a phone, emptied the wizard).
import { expect, type Page, test } from '@playwright/test';
import { SEED_DISTRIBUTORS } from '../../seed/data';
import { createTestAccount, uniqueTag } from '../support/emulator-admin';
import {
  CREATE_BUTTON,
  fillFoundingWizard,
  FOUNDING_PATH,
  FOUNDING_PLANT,
  FOUNDING_VERIFICATION,
} from '../support/founding';
import { signInWithPassword } from '../support/sign-in';
import { dismissStorageNotice } from '../support/storage-notice';

test.skip(
  process.env.E2E_EMULATORS !== 'true',
  'Needs the seeded emulators: run with E2E_EMULATORS=true',
);

/** Follows the fake pattern 9000000xx of the seed. */
const BUSINESS_PHONE = '900000094';
const TAKEN = 'Ese enlace ya lo usa otra distribuidora. Prueba con otro.';

const heading = (page: Page) => page.getByRole('heading', { level: 1 });
const nameField = (page: Page) => page.getByLabel('Nombre de la distribuidora');
const next = (page: Page) => page.getByRole('button', { name: 'Continuar' }).click();

/** Everything of the first step but the link, which each test decides. */
async function fillBusiness(page: Page, name: string): Promise<void> {
  await nameField(page).fill(name);
  await page.getByLabel('Teléfono del negocio').fill(BUSINESS_PHONE);
  await page.getByLabel(FOUNDING_VERIFICATION.taxIdLabel).fill(FOUNDING_VERIFICATION.taxId);
  await page.getByLabel(FOUNDING_VERIFICATION.legalNameLabel).fill(FOUNDING_VERIFICATION.legalName);
  await page.getByLabel(FOUNDING_VERIFICATION.registryLabel).fill(FOUNDING_VERIFICATION.registry);
}

test.beforeEach(async ({ page }, testInfo) => {
  await dismissStorageNotice(page);
  const account = await createTestAccount(uniqueTag(testInfo));
  await signInWithPassword(page, account.email, '/inicio');
  // By the link a person follows, not by typing the address: the home stays in the history.
  await page.getByRole('link', { name: 'Súmala a Hornilla' }).click();
  await expect(page).toHaveURL(new RegExp(`${FOUNDING_PATH}$`));
});

test('back and forward walk the steps, each with what was typed on it', async ({
  page,
}, testInfo) => {
  const tag = uniqueTag(testInfo);
  await fillBusiness(page, `Gas Historial ${tag}`);
  await next(page);
  await expect(heading(page)).toContainText('tu planta.');
  await page.getByLabel('Latitud').fill(FOUNDING_PLANT.latitude);
  await page.getByLabel('Longitud').fill(FOUNDING_PLANT.longitude);
  await page.getByLabel(/Dirección de la planta/).fill(FOUNDING_PLANT.address);
  await next(page);
  await expect(heading(page)).toContainText('tu color.');

  await page.goBack();
  await expect(heading(page)).toContainText('tu planta.');
  await expect(page.getByLabel('Latitud')).toHaveValue(FOUNDING_PLANT.latitude);
  await page.goBack();
  await expect(heading(page)).toContainText('tu negocio.');
  await expect(nameField(page)).toHaveValue(`Gas Historial ${tag}`);
  await expect(page.getByLabel(FOUNDING_VERIFICATION.taxIdLabel)).toHaveValue(
    FOUNDING_VERIFICATION.taxId,
  );

  await page.goForward();
  await expect(heading(page)).toContainText('tu planta.');
  await expect(page.getByLabel(/Dirección de la planta/)).toHaveValue(FOUNDING_PLANT.address);
  await page.goForward();
  await expect(heading(page)).toContainText('tu color.');
  // The address never changed: a step is not a page of its own.
  await expect(page).toHaveURL(new RegExp(`${FOUNDING_PATH}$`));
});

test('leaving the wizard with "back" and returning with "forward" keeps the answers', async ({
  page,
}, testInfo) => {
  const name = `Gas Regreso ${uniqueTag(testInfo)}`;
  await fillBusiness(page, name);

  await page.goBack();
  await expect(page).toHaveURL(/\/inicio$/);
  await page.goForward();

  await expect(heading(page)).toContainText('tu negocio.');
  await expect(nameField(page)).toHaveValue(name);
});

test('"forward" does not reach a step whose previous one stopped being valid', async ({
  page,
}, testInfo) => {
  await fillBusiness(page, `Gas Adelante ${uniqueTag(testInfo)}`);
  await next(page);
  await expect(heading(page)).toContainText('tu planta.');
  await page.goBack();
  await expect(heading(page)).toContainText('tu negocio.');

  await page.getByLabel('Teléfono del negocio').fill('');
  await page.goForward();

  // Still the first step, and it says what is missing.
  await expect(heading(page)).toContainText('tu negocio.');
  await expect(page.getByLabel('Teléfono del negocio')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByRole('progressbar', { name: 'Avance del registro' })).toHaveAttribute(
    'aria-valuetext',
    'Paso 1 de 4: Negocio',
  );
});

test('"Continuar" waits for the answer about the link, and a taken link holds the first step', async ({
  page,
}, testInfo) => {
  await fillBusiness(page, `Gas Enlace ${uniqueTag(testInfo)}`);
  await page.getByLabel('Enlace de tu página').fill(SEED_DISTRIBUTORS.a.slug);

  // Pressed at once, before the check of the link has answered.
  await next(page);

  await expect(page.getByText(TAKEN)).toBeVisible();
  await expect(heading(page)).toContainText('tu negocio.');
  // A free one, pressed at once again: it goes on by itself when the answer comes.
  await page.getByLabel('Enlace de tu página').fill(`enlace-${uniqueTag(testInfo)}`);
  await next(page);
  await expect(heading(page)).toContainText('tu planta.');
});

test('after founding, "back" does not offer an empty wizard ready to found another', async ({
  page,
}, testInfo) => {
  test.slow();
  const tag = uniqueTag(testInfo);
  const name = `Gas Hecho ${tag}`;
  await fillFoundingWizard(page, { name, slug: `hecho-${tag}` });
  await page.getByRole('button', { name: CREATE_BUTTON }).click();
  await expect(page).toHaveURL(/\/central$/);
  await expect(heading(page)).toHaveText(`Hoy en ${name}.`);

  await page.goBack();

  await expect(
    page.getByRole('heading', { name: 'Tu distribuidora ya está creada.' }),
  ).toBeVisible();
  await expect(nameField(page)).toHaveCount(0);
  await expect(page.getByRole('button', { name: CREATE_BUTTON })).toHaveCount(0);
  // Whoever does want another one says so, and starts from an empty first step.
  await page.getByRole('button', { name: 'Registrar otra distribuidora' }).click();
  await expect(heading(page)).toContainText('tu negocio.');
  await expect(nameField(page)).toHaveValue('');
});
