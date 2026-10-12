// PLAN 2.2. The steps of the sign-up of a distributor are entries of the browser history
// (role-walker, 2026-10-11: the back button, or the back gesture of a phone, emptied the wizard).
import { expect, type Page, test } from '@playwright/test';
import { SEED_DISTRIBUTORS, type SeedUser } from '../../seed/data';
import { createTestAccount, readDocument, uniqueTag } from '../support/emulator-admin';
import {
  CREATE_BUTTON,
  fillFoundingWizard,
  FOUNDING_PATH,
  FOUNDING_PLANT,
  FOUNDING_VERIFICATION,
} from '../support/founding';
import { signInWithPassword, submitSignIn } from '../support/sign-in';
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
const enterWizard = (page: Page) => page.getByRole('link', { name: 'Súmala a Hornilla' }).click();

/** The account each test signs in with: the tests of one worker run one after another. */
let founder: SeedUser;

/** Everything of the first step but the link, which each test decides. */
async function fillBusiness(page: Page, name: string): Promise<void> {
  await nameField(page).fill(name);
  await page.getByLabel('Teléfono del negocio').fill(BUSINESS_PHONE);
  await page.getByLabel(FOUNDING_VERIFICATION.taxIdLabel).fill(FOUNDING_VERIFICATION.taxId);
  await page.getByLabel(FOUNDING_VERIFICATION.legalNameLabel).fill(FOUNDING_VERIFICATION.legalName);
  await page.getByLabel(FOUNDING_VERIFICATION.registryLabel).fill(FOUNDING_VERIFICATION.registry);
}

async function fillPlant(page: Page): Promise<void> {
  await page.getByLabel('Latitud').fill(FOUNDING_PLANT.latitude);
  await page.getByLabel('Longitud').fill(FOUNDING_PLANT.longitude);
  await page.getByLabel(/Dirección de la planta/).fill(FOUNDING_PLANT.address);
}

/** Presses "back" until the wizard is on screen again: how many entries lie between varies. */
async function backToWizard(page: Page): Promise<void> {
  const wizard = new RegExp(`${FOUNDING_PATH}$`);
  await expect(async () => {
    await page.goBack();
    expect(page.url()).toMatch(wizard);
  }).toPass();
}

test.beforeEach(async ({ page }, testInfo) => {
  await dismissStorageNotice(page);
  founder = await createTestAccount(uniqueTag(testInfo));
  await signInWithPassword(page, founder.email, '/inicio');
  // By the link a person follows, not by typing the address: the home stays in the history.
  await enterWizard(page);
  await expect(page).toHaveURL(new RegExp(`${FOUNDING_PATH}$`));
});

test('back and forward walk the steps, each with what was typed on it', async ({
  page,
}, testInfo) => {
  const tag = uniqueTag(testInfo);
  await fillBusiness(page, `Gas Historial ${tag}`);
  await next(page);
  await expect(heading(page)).toContainText('tu planta.');
  await fillPlant(page);
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

  await expect(page.getByRole('heading', { name: `${name} ya está creada.` })).toBeVisible();
  await expect(nameField(page)).toHaveCount(0);
  await expect(page.getByRole('button', { name: CREATE_BUTTON })).toHaveCount(0);
  // Whoever does want another one says so, and starts from an empty first step.
  await page.getByRole('button', { name: 'Registrar otra distribuidora' }).click();
  await expect(heading(page)).toContainText('tu negocio.');
  await expect(nameField(page)).toHaveValue('');
});

// Walked by hand on 2026-10-12 (PLAN 2.2): what the history of a finished or emptied sign-up
// must never give back is a broken step, the answers of somebody else or a second distributor.
test('after founding, back and forward keep saying it is done, and a double click founds once', async ({
  page,
}, testInfo) => {
  test.slow();
  const tag = uniqueTag(testInfo);
  const name = `Gas Doble ${tag}`;
  const done = page.getByRole('heading', { name: `${name} ya está creada.` });
  await fillFoundingWizard(page, { name, slug: `doble-${tag}` });

  await page.getByRole('button', { name: CREATE_BUTTON }).dblclick();

  await expect(page).toHaveURL(/\/central$/);
  await expect(heading(page)).toHaveText(`Hoy en ${name}.`);
  await page.goBack();
  await expect(done).toBeVisible();
  await page.goForward();
  await expect(heading(page)).toHaveText(`Hoy en ${name}.`);
  await page.goBack();
  await expect(done).toBeVisible();
  // One step further back: still a step of the sign-up that ended, never its form.
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`${FOUNDING_PATH}$`));
  await expect(done).toBeVisible();
  await expect(nameField(page)).toHaveCount(0);
  await expect(page.getByRole('button', { name: CREATE_BUTTON })).toHaveCount(0);
  const profile = await readDocument(`users/${founder.uid}`);
  expect(profile?.ownedDistributorIds).toHaveLength(1);
});

test('a reload on the third step leaves an empty first step and a history that still walks', async ({
  page,
}, testInfo) => {
  const name = `Gas Recarga ${uniqueTag(testInfo)}`;
  const toThirdStep = async () => {
    await fillBusiness(page, name);
    await next(page);
    await expect(heading(page)).toContainText('tu planta.');
    await fillPlant(page);
    await next(page);
    await expect(heading(page)).toContainText('tu color.');
  };
  await toThirdStep();

  await page.reload();

  // Known: the reload empties the answers (role-walker.spec.ts holds that `test.fail`).
  await expect(heading(page)).toContainText('tu negocio.');
  await expect(nameField(page)).toHaveValue('');
  // The entries of the sign-up that the reload ended are a first step, not a dead end.
  await page.goBack();
  await expect(heading(page)).toContainText('tu negocio.');
  await page.goForward();
  await expect(heading(page)).toContainText('tu negocio.');
  await toThirdStep();
  // The "Atrás" of the page and the one of the browser, mixed.
  await page.getByRole('button', { name: 'Atrás' }).click();
  await expect(heading(page)).toContainText('tu planta.');
  await expect(page.getByLabel('Latitud')).toHaveValue(FOUNDING_PLANT.latitude);
  await page.goBack();
  await expect(heading(page)).toContainText('tu negocio.');
  await expect(nameField(page)).toHaveValue(name);
  await page.goForward();
  await expect(heading(page)).toContainText('tu planta.');
  await page.goForward();
  await expect(heading(page)).toContainText('tu color.');
  await next(page);
  await expect(heading(page)).toContainText('crea tu distribuidora.');
});

test('another account that signs in on the same tab finds nothing of the sign-up left open', async ({
  page,
}, testInfo) => {
  test.slow();
  const tag = uniqueTag(testInfo);
  const name = `Gas Ajeno ${tag}`;
  const other = await createTestAccount(`${tag}-otra`);
  await fillBusiness(page, name);
  await next(page);
  await expect(heading(page)).toContainText('tu planta.');

  // Out through the header of the wizard, then the session ends and somebody else signs in.
  await page.getByRole('link', { name: 'Salir' }).click();
  // Signing out reloads the app at the home: the next click waits for that reload to be over.
  const restarted = page.waitForEvent('load');
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await restarted;
  await page.getByRole('banner').getByRole('link', { name: 'Ingresar' }).click();
  await submitSignIn(page, other.email);
  await expect(page).toHaveURL(/\/inicio$/);
  await enterWizard(page);

  await expect(heading(page)).toContainText('tu negocio.');
  await expect(nameField(page)).toHaveValue('');
  await expect(page.getByLabel(FOUNDING_VERIFICATION.taxIdLabel)).toHaveValue('');
  // Neither do the entries the first account left in the history of the tab.
  await page.goBack();
  await expect(page).toHaveURL(/\/inicio$/);
  await backToWizard(page);
  await expect(heading(page)).toContainText('tu negocio.');
  await expect(nameField(page)).toHaveValue('');
  await expect(page.getByLabel(FOUNDING_VERIFICATION.taxIdLabel)).toHaveValue('');
  await expect(page.getByText(name)).toHaveCount(0);
});
