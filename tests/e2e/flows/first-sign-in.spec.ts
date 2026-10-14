import { expect, type Page, test } from '@playwright/test';
import { findAuthAccount, readDocument, uniqueTag } from '../support/emulator-admin';
import { type E2eIdentity, signInHere } from '../support/sign-in';
import { dismissStorageNotice } from '../support/storage-notice';

test.skip(
  process.env.E2E_EMULATORS !== 'true',
  'Needs the seeded emulators: run with E2E_EMULATORS=true',
);

const TERMS_BOX = /Acepto los Términos y condiciones/;
const PRIVACY_BOX = /Leí la Política de privacidad/;
const CURRENT_TERMS = '0.4';
const CURRENT_PRIVACY = '0.4';
const GOOGLE_NAME = 'Y. De Google';
const CONFIRMED_NAME = 'Y. Confirmada';
/** Follows the fake pattern 9000000xx of the seed. */
const NEW_PHONE = '900000097';

const heading = (page: Page) => page.getByRole('heading', { level: 1 });

/** Somebody Hornilla has never seen: the first sign-in is what creates the account. */
const newcomer = (tag: string): E2eIdentity => ({
  email: `nueva-${tag}@example.com`,
  displayName: GOOGLE_NAME,
});

async function acceptBoth(page: Page) {
  await page.getByRole('checkbox', { name: TERMS_BOX }).check();
  await page.getByRole('checkbox', { name: PRIVACY_BOX }).check();
  await page.getByRole('button', { name: 'Aceptar y continuar' }).click();
}

test.beforeEach(async ({ page }) => {
  await dismissStorageNotice(page);
});

// PLAN 2.1, 2.7, 2.9, 2.11: from nothing to the home of a customer. There is no registration:
// the person signs in with Google, confirms the data and accepts. A profile only exists for a
// verified e-mail, and nothing is stored until the person accepts.
test('a new person signs in, confirms the data, accepts the terms and lands on the customer home', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const person = newcomer(uniqueTag(testInfo));
  expect(await findAuthAccount(person.email)).toBeNull();
  await page.goto('/registro');
  await expect(heading(page)).toHaveText('Crea tu cuenta en Hornilla.');

  await signInHere(page, person);

  // The account exists, with the e-mail Google confirmed, and nothing else does.
  await expect(page).toHaveURL(/\/aceptar-terminos$/);
  await expect(heading(page)).toHaveText('Un paso antes de empezar.');
  const account = await findAuthAccount(person.email);
  expect(account?.emailVerified).toBe(true);
  expect(await readDocument(`users/${account?.localId}`)).toBeNull();
  // The name Google gave waits to be confirmed or corrected; the phone was never asked.
  await expect(page.getByLabel('Nombre', { exact: true })).toHaveValue(GOOGLE_NAME);
  await expect(page.getByLabel('Celular (opcional)')).toHaveValue('');
  await page.getByLabel('Nombre', { exact: true }).fill(CONFIRMED_NAME);
  await page.getByLabel('Celular (opcional)').fill(NEW_PHONE);
  await acceptBoth(page);

  await expect(page).toHaveURL(/\/inicio$/);
  expect(await readDocument(`users/${account?.localId}`)).toMatchObject({
    displayName: CONFIRMED_NAME,
    phone: NEW_PHONE,
    ownedDistributorIds: [],
    terms: { version: CURRENT_TERMS },
    privacy: { version: CURRENT_PRIVACY },
  });
  // Each acceptance left its line in the history.
  for (const entry of [`terms-${CURRENT_TERMS}`, `privacy-${CURRENT_PRIVACY}`]) {
    expect(await readDocument(`users/${account?.localId}/acceptances/${entry}`)).not.toBeNull();
  }
  await expect(heading(page)).toContainText('Hola, Y.');
  // The session survives a reload and the account shows what was confirmed.
  await page.goto('/cuenta');
  await expect(page.getByLabel('Nombre', { exact: true })).toHaveValue(CONFIRMED_NAME);
  await expect(page.getByLabel('Correo', { exact: true })).toHaveValue(person.email);
  expect(errors).toEqual([]);
});

// PLAN 2.2, 2.11 ("que el registro conserve el destino"). Defect reported by flow-tester on
// 2026-10-10: a visitor taps "Súmala a Hornilla" and, having no account, signs in with Google.
// Since 2026-10-14 (PLAN §11) the band takes a visitor to /registro?desde=/distribuidora/nueva,
// the screen that tells somebody new that the account is the Google one. The destination must
// travel with the person through the sign-in and the terms.
test('entering from "¿Tienes una distribuidora?" ends on the sign-up of the distributor', async ({
  page,
}, testInfo) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Súmala a Hornilla' }).click();
  await expect(page).toHaveURL(/\/registro\?desde=%2Fdistribuidora%2Fnueva$/);
  await expect(heading(page)).toHaveText('Crea tu cuenta en Hornilla.');

  await signInHere(page, newcomer(uniqueTag(testInfo)));
  await expect(page).toHaveURL(/\/aceptar-terminos$/);
  await acceptBoth(page);

  await expect(page).toHaveURL(/\/distribuidora\/nueva$/);
  await expect(heading(page)).toContainText('tu negocio.');
});

// PLAN 2.11: the destination also survives a reload of the tab on the pending step.
test('the destination survives reloading the tab on the terms step', async ({ page }, testInfo) => {
  await page.goto('/registro?desde=%2Fdistribuidora%2Fnueva');
  await signInHere(page, newcomer(uniqueTag(testInfo)));
  await expect(page).toHaveURL(/\/aceptar-terminos$/);

  await page.reload();
  await expect(heading(page)).toHaveText('Un paso antes de empezar.');
  await acceptBoth(page);

  await expect(page).toHaveURL(/\/distribuidora\/nueva$/);
});

// PLAN 2.1: an account that already exists is taken straight to where it was going.
test('a returning person is taken to where it was going, without any step', async ({
  page,
}, testInfo) => {
  const person = newcomer(uniqueTag(testInfo));
  await page.goto('/ingresar');
  await signInHere(page, person);
  await expect(page).toHaveURL(/\/aceptar-terminos$/);
  await acceptBoth(page);
  await expect(page).toHaveURL(/\/inicio$/);
  const restarted = page.waitForEvent('load');
  await page.goto('/cuenta');
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await restarted;
  await expect(page.getByRole('banner').getByRole('link', { name: 'Ingresar' })).toBeVisible();

  await page.goto('/pedidos');
  await expect(page).toHaveURL(/\/ingresar\?desde=%2Fpedidos$/);
  await signInHere(page, person);

  await expect(page).toHaveURL(/\/pedidos$/);
});
