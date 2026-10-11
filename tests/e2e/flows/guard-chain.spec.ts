import { expect, type Page, test } from '@playwright/test';
import { markEmailVerified } from '../../support/emulator';
import {
  createTestAccount,
  findAuthAccount,
  readDocument,
  type TestProfile,
  uniqueTag,
} from '../support/emulator-admin';
import { expectDeviceCleared } from '../support/device-storage';
import { signInWithPassword, submitSignIn } from '../support/sign-in';
import { dismissStorageNotice } from '../support/storage-notice';

test.skip(
  process.env.E2E_EMULATORS !== 'true',
  'Needs the seeded emulators: run with E2E_EMULATORS=true',
);

const TERMS_BOX = /Acepto los Términos y condiciones/;
const PRIVACY_BOX = /Leí la Política de privacidad/;
const CURRENT_VERSION = '0.1';
/** Every signed-in address somebody could type to skip a pending step. */
const WAYS_AROUND = ['/inicio', '/pedidos', '/cuenta', '/distribuidora/nueva', '/central', '/app'];

const heading = (page: Page) => page.getByRole('heading', { level: 1 });

// Each flow types several addresses, and every one of them loads the app again.
test.slow();

test.beforeEach(async ({ page }) => {
  await dismissStorageNotice(page);
});

// PLAN 2.1, 2.4: an account whose e-mail is not verified waits at "verifica tu correo".
test('an unverified account cannot go past the verification step by typing an address', async ({
  page,
}, testInfo) => {
  const account = await createTestAccount(uniqueTag(testInfo), { emailVerified: false });
  await signInWithPassword(page, account.email, '/verificar-correo');
  await expect(page.getByText(account.email)).toBeVisible();

  for (const path of WAYS_AROUND) {
    await page.goto(path);
    await expect(page, `typing ${path}`).toHaveURL(/\/verificar-correo$/);
    await expect(heading(page)).toContainText('Verifica tu correo.');
  }
  // Saying "I did" without having done it changes nothing.
  await page.getByRole('button', { name: 'Ya lo verifiqué' }).click();
  await expect(page.getByText(/Todavía no figura como verificado/)).toBeVisible();
  await expect(page).toHaveURL(/\/verificar-correo$/);

  // The person follows the link of the e-mail (in another app) and comes back to this tab.
  await markEmailVerified(account.uid);
  await page.getByRole('button', { name: 'Ya lo verifiqué' }).click();

  await expect(page).toHaveURL(/\/inicio$/);
  await expect(heading(page)).toContainText('Hola, Z.');
  // And the step is gone for good: its address now leads home.
  await page.goto('/verificar-correo');
  await expect(page).toHaveURL(/\/inicio$/);
});

// PLAN 2.7, 2.9: without both acceptances on record there is no way in.
const PENDING_ACCEPTANCES: [TestProfile, string][] = [
  ['none', 'Un paso antes de empezar.'],
  ['outdated', 'Actualizamos los términos.'],
  ['privacyMissing', 'Actualizamos la política de privacidad.'],
];

for (const [profile, title] of PENDING_ACCEPTANCES) {
  test(`an account with profile "${profile}" must tick both boxes before entering`, async ({
    page,
  }, testInfo) => {
    const account = await createTestAccount(uniqueTag(testInfo), { profile });
    await signInWithPassword(page, account.email, '/aceptar-terminos');
    await expect(heading(page)).toHaveText(title);
    await expect(page.getByRole('checkbox', { name: TERMS_BOX })).not.toBeChecked();
    await expect(page.getByRole('checkbox', { name: PRIVACY_BOX })).not.toBeChecked();

    for (const path of [...WAYS_AROUND, '/verificar-correo']) {
      await page.goto(path);
      await expect(page, `typing ${path}`).toHaveURL(/\/aceptar-terminos$/);
      await expect(heading(page)).toHaveText(title);
    }
    // One box is not enough, and nothing is recorded meanwhile.
    await page.getByRole('checkbox', { name: TERMS_BOX }).check();
    await page.getByRole('button', { name: 'Aceptar y continuar' }).click();
    await expect(
      page.getByText('Marca esta casilla para autorizar el uso de tus datos y continuar.'),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/aceptar-terminos$/);

    await page.getByRole('checkbox', { name: PRIVACY_BOX }).check();
    await page.getByRole('button', { name: 'Aceptar y continuar' }).click();

    await expect(page).toHaveURL(/\/inicio$/);
    await expect(heading(page)).toContainText('Hola');
    expect(await readDocument(`users/${account.uid}`)).toMatchObject({
      terms: { version: CURRENT_VERSION },
      privacy: { version: CURRENT_VERSION },
    });
    await page.goto('/aceptar-terminos');
    await expect(page).toHaveURL(/\/inicio$/);
  });
}

// The order of the guards (PLAN §11, 2.11): the verified e-mail first, then the terms, then the
// area. Nothing is stored, and no consent is asked, for an address nobody proved is theirs.
test('an account with nothing done goes through the e-mail, then the terms, then its home', async ({
  page,
}, testInfo) => {
  const account = await createTestAccount(uniqueTag(testInfo), {
    emailVerified: false,
    profile: 'none',
  });
  await signInWithPassword(page, account.email, '/verificar-correo');
  for (const path of [...WAYS_AROUND, '/aceptar-terminos']) {
    await page.goto(path);
    await expect(page, `typing ${path}`).toHaveURL(/\/verificar-correo$/);
  }
  expect(await readDocument(`users/${account.uid}`)).toBeNull();

  await markEmailVerified(account.uid);
  await page.getByRole('button', { name: 'Ya lo verifiqué' }).click();

  await expect(page).toHaveURL(/\/aceptar-terminos$/);
  await page.goto('/inicio');
  await expect(page).toHaveURL(/\/aceptar-terminos$/);
  expect(await readDocument(`users/${account.uid}`)).toBeNull();
  await page.getByRole('checkbox', { name: TERMS_BOX }).check();
  await page.getByRole('checkbox', { name: PRIVACY_BOX }).check();
  await page.getByRole('button', { name: 'Aceptar y continuar' }).click();

  await expect(page).toHaveURL(/\/inicio$/);
  expect(await readDocument(`users/${account.uid}`)).toMatchObject({
    terms: { version: CURRENT_VERSION },
    privacy: { version: CURRENT_VERSION },
  });
});

// PLAN 2.9: whoever does not accept can leave, and the account goes with them.
test('"No acepto" deletes the account that never accepted and returns to the home', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const account = await createTestAccount(uniqueTag(testInfo), { profile: 'none' });
  await signInWithPassword(page, account.email, '/aceptar-terminos');

  // It asks once more, and "Cancelar" keeps the account.
  await page.getByRole('button', { name: 'No acepto: eliminar mi cuenta' }).click();
  const confirmation = page.getByRole('group', { name: '¿Eliminar tu cuenta?' });
  await confirmation.getByRole('button', { name: 'Cancelar' }).click();
  expect(await findAuthAccount(account.email)).not.toBeNull();

  await page.getByRole('button', { name: 'No acepto: eliminar mi cuenta' }).click();
  await confirmation.getByRole('button', { name: 'Sí, eliminar mi cuenta' }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('banner').getByRole('link', { name: 'Ingresar' })).toBeVisible();
  await expect(heading(page)).toContainText('Pide tu gas');
  expect(await findAuthAccount(account.email)).toBeNull();
  expect(await readDocument(`users/${account.uid}`)).toBeNull();
  expect(errors).toEqual([]);
  // The tab reloads itself once it has cleared what the account left on the device: wait for
  // that before typing an address, or the two navigations cross.
  await expectDeviceCleared(page);
  // The account is gone for real: its credentials no longer open anything.
  await page.goto('/ingresar');
  await submitSignIn(page, account.email);
  await expect(page.getByText('El correo o la contraseña no coinciden.')).toBeVisible();
});

// PLAN 2.11: an account that already accepted has data, so it cannot be thrown away from this
// screen. It is not offered a button that would only refuse: "No acepto" leads to where the
// deletion is asked for.
test('"No acepto" sends an account that already has a profile to ask for its deletion', async ({
  page,
}, testInfo) => {
  const account = await createTestAccount(uniqueTag(testInfo), { profile: 'outdated' });
  await signInWithPassword(page, account.email, '/aceptar-terminos');

  await expect(page.getByRole('button', { name: 'No acepto: eliminar mi cuenta' })).toHaveCount(0);
  // A renewal does not ask for the name again: the profile already has one.
  await expect(page.getByLabel('Nombre', { exact: true })).toHaveCount(0);
  await page.getByRole('link', { name: 'No acepto: pedir que eliminen mi cuenta' }).click();

  // Asking is not a way around the step: the contact page is public, the areas stay closed.
  await expect(page).toHaveURL(/\/contacto$/);
  await expect(heading(page)).toHaveText('Contacto y reclamos.');
  expect(await findAuthAccount(account.email)).not.toBeNull();
  await page.goto('/inicio');
  await expect(page).toHaveURL(/\/aceptar-terminos$/);
});
