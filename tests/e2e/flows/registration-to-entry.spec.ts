import { expect, type Page, test } from '@playwright/test';
import { SEED_PASSWORD } from '../../seed/data';
import { markEmailVerified, sentAuthEmails } from '../../support/emulator';
import { expectDeviceCleared } from '../support/device-storage';
import { findAuthAccount, readDocument, uniqueTag } from '../support/emulator-admin';
import { dismissStorageNotice } from '../support/storage-notice';

test.skip(
  process.env.E2E_EMULATORS !== 'true',
  'Needs the seeded emulators: run with E2E_EMULATORS=true',
);

const TERMS_BOX = /Acepto los Términos y condiciones/;
const PRIVACY_BOX = /Leí la Política de privacidad/;
const CURRENT_VERSION = '0.1';
const NEW_NAME = 'Y. Registro';
/** Follows the fake pattern 9000000xx of the seed. */
const NEW_PHONE = '900000097';

const heading = (page: Page) => page.getByRole('heading', { level: 1 });

/** Fills and sends the registration form on screen; ends at "verifica tu correo". */
async function register(page: Page, email: string) {
  await page.getByLabel('Nombre', { exact: true }).fill(NEW_NAME);
  await page.getByLabel('Correo', { exact: true }).fill(email);
  await page.getByLabel('Contraseña', { exact: true }).fill(SEED_PASSWORD);
  await page.getByRole('button', { name: 'Crear cuenta', exact: true }).click();
  await expect(page).toHaveURL(/\/verificar-correo$/);
}

/** What following the link of the verification e-mail does, then back to the waiting tab. */
async function verifyAndComeBack(page: Page, email: string) {
  const account = await findAuthAccount(email);
  expect(account, 'the registration created the Auth account').not.toBeNull();
  await markEmailVerified(account?.localId ?? '');
  await page.getByRole('button', { name: 'Ya lo verifiqué' }).click();
}

test.beforeEach(async ({ page }) => {
  await dismissStorageNotice(page);
});

// PLAN 2.1, 2.7, 2.9, 2.11: from nothing to the home of a customer. The order is: register,
// verify the e-mail, accept the terms. Nothing is stored before the e-mail is verified.
test('a new person registers, verifies the e-mail, accepts the terms and lands on the customer home', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const email = `registro-${uniqueTag(testInfo)}@example.com`;
  await page.goto('/registro');

  await register(page, email);

  // The e-mail went out and the account waits.
  await expect(page.getByText(email)).toBeVisible();
  const sent = await sentAuthEmails();
  expect(
    sent.filter((mail) => mail.email === email && mail.requestType === 'VERIFY_EMAIL'),
  ).toHaveLength(1);
  const account = await findAuthAccount(email);
  expect(account?.emailVerified).toBe(false);
  // Nobody has proved yet that the address is theirs: no profile, no consent on record.
  expect(await readDocument(`users/${account?.localId}`)).toBeNull();

  await verifyAndComeBack(page, email);

  // Verified: now the terms, and only then the profile with both acceptances.
  await expect(page).toHaveURL(/\/aceptar-terminos$/);
  expect(await readDocument(`users/${account?.localId}`)).toBeNull();
  // What was typed when registering waits here to be confirmed or corrected.
  await expect(page.getByLabel('Nombre', { exact: true })).toHaveValue(NEW_NAME);
  await expect(page.getByLabel('Celular (opcional)')).toHaveValue('');
  await page.getByLabel('Celular (opcional)').fill(NEW_PHONE);
  await page.getByRole('checkbox', { name: TERMS_BOX }).check();
  await page.getByRole('checkbox', { name: PRIVACY_BOX }).check();
  await page.getByRole('button', { name: 'Aceptar y continuar' }).click();

  await expect(page).toHaveURL(/\/inicio$/);
  // The name typed at registration was kept in the tab and is the one of the profile.
  expect(await readDocument(`users/${account?.localId}`)).toMatchObject({
    displayName: NEW_NAME,
    phone: NEW_PHONE,
    ownedDistributorIds: [],
    terms: { version: CURRENT_VERSION },
    privacy: { version: CURRENT_VERSION },
  });
  expect(await page.evaluate(() => sessionStorage.getItem('hornilla.pendingProfile'))).toBeNull();
  await expect(heading(page)).toContainText('Hola, Y.');
  // The session survives a reload and the account shows what was typed.
  await page.goto('/cuenta');
  await expect(page.getByLabel('Nombre', { exact: true })).toHaveValue(NEW_NAME);
  await expect(page.getByLabel('Correo', { exact: true })).toHaveValue(email);
  expect(errors).toEqual([]);
});

// PLAN 2.1 (the wait between two verification e-mails, `RESEND_WAIT_SECONDS`).
// Defect reported by flow-tester on 2026-10-10, fixed on 2026-10-11 (PLAN 2.11): right after
// registering, "Reenviar correo" was enabled at once. The registration screen navigated to
// /verificar-correo with the `justRegistered` state but, still on screen during its exit
// transition, saw a session with no action running and rendered its own redirect to /app,
// which came back to /verificar-correo WITHOUT the state.
test('resending the verification e-mail is held back right after registering', async ({
  page,
}, testInfo) => {
  const email = `registro-${uniqueTag(testInfo)}@example.com`;
  await page.goto('/registro');

  await register(page, email);

  await expect(page.getByRole('button', { name: /Reenviar en/ })).toBeDisabled();
});

// PLAN 2.2, 2.11 ("que el registro conserve el destino"). Defect reported by flow-tester on
// 2026-10-10, fixed on 2026-10-11: a visitor taps "Súmala a Hornilla", is asked to sign in at
// /ingresar?desde=/distribuidora/nueva and, having no account, follows "Crear cuenta". The
// destination was lost on the way and the person ended on the customer home. Now it travels
// with the account through the registration, the verification and the terms.
test('registering from "¿Tienes una distribuidora?" ends on the sign-up of the distributor', async ({
  page,
}, testInfo) => {
  const email = `registro-${uniqueTag(testInfo)}@example.com`;
  await page.goto('/');
  await page.getByRole('link', { name: 'Súmala a Hornilla' }).click();
  await expect(page).toHaveURL(/\/ingresar\?desde=%2Fdistribuidora%2Fnueva$/);
  await expect(page.getByText('Ingresa para continuar.')).toBeVisible();
  await page.getByRole('main').getByRole('link', { name: 'Crear cuenta' }).click();
  await expect(page).toHaveURL(/\/registro\?desde=%2Fdistribuidora%2Fnueva$/);

  await register(page, email);
  await verifyAndComeBack(page, email);
  // Since PLAN 2.11 the terms are accepted after the verification, before going on.
  await expect(page).toHaveURL(/\/aceptar-terminos$/);
  await page.getByRole('checkbox', { name: TERMS_BOX }).check();
  await page.getByRole('checkbox', { name: PRIVACY_BOX }).check();
  await page.getByRole('button', { name: 'Aceptar y continuar' }).click();

  await expect(page).toHaveURL(/\/distribuidora\/nueva$/);
  await expect(heading(page)).toContainText('tu negocio.');
});

// PLAN 2.11: the destination also survives a reload of the tab on either pending step.
test('the destination survives reloading the tab on both pending steps', async ({
  page,
}, testInfo) => {
  const email = `registro-${uniqueTag(testInfo)}@example.com`;
  await page.goto('/registro?desde=%2Fdistribuidora%2Fnueva');
  await register(page, email);

  await page.reload();
  await expect(heading(page)).toContainText('Verifica tu correo.');
  await verifyAndComeBack(page, email);
  await expect(page).toHaveURL(/\/aceptar-terminos$/);
  await page.reload();
  await page.getByRole('checkbox', { name: TERMS_BOX }).check();
  await page.getByRole('checkbox', { name: PRIVACY_BOX }).check();
  await page.getByRole('button', { name: 'Aceptar y continuar' }).click();

  await expect(page).toHaveURL(/\/distribuidora\/nueva$/);
});

// PLAN 2.11: an account that never verifies its e-mail no longer reaches the terms step, so
// the way out of deleting it lives on the verification step.
test('"No quiero continuar" deletes the account that has not verified its e-mail', async ({
  page,
}, testInfo) => {
  const email = `registro-${uniqueTag(testInfo)}@example.com`;
  await page.goto('/registro');
  await register(page, email);
  expect(await findAuthAccount(email)).not.toBeNull();

  await page.getByRole('button', { name: 'No quiero continuar: eliminar mi cuenta' }).click();
  const confirmation = page.getByRole('group', { name: '¿Eliminar tu cuenta?' });
  await confirmation.getByRole('button', { name: 'Sí, eliminar mi cuenta' }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(heading(page)).toContainText('Pide tu gas');
  expect(await findAuthAccount(email)).toBeNull();
  await expectDeviceCleared(page);
  expect(await page.evaluate(() => sessionStorage.getItem('hornilla.pendingProfile'))).toBeNull();
});
