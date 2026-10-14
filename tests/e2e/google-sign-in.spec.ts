import { expect, type Page, test } from '@playwright/test';
import { findAuthAccount, readDocument, uniqueTag } from './support/emulator-admin';
import { dismissStorageNotice } from './support/storage-notice';

test.skip(
  process.env.E2E_EMULATORS !== 'true',
  'Needs the seeded emulators: run with E2E_EMULATORS=true',
);

const heading = (page: Page) => page.getByRole('heading', { level: 1 });

/** What the page of the Auth emulator asks other sites for: its looks, nothing it needs. */
const WINDOW_DRESSING = /^https:\/\/(unpkg\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)\//;

/**
 * Presses the real button and hands over the window it opens. Against the emulators that
 * window is a page of the Auth emulator itself; with the real service it is Google's.
 * That page waits for a style library of another site before it wires its own buttons: the
 * request is cut short, so the test needs no internet and the page is ready once it has loaded.
 */
async function openGoogleWindow(page: Page): Promise<Page> {
  await page.context().route(WINDOW_DRESSING, (route) => route.abort());
  const opening = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Continuar con Google' }).click();
  const popup = await opening;
  await popup.waitForLoadState('domcontentloaded');
  return popup;
}

/** Goes through the window as a person who types in the Google account to use. */
async function continueWithGoogle(page: Page, email: string, name: string) {
  const popup = await openGoogleWindow(page);
  await popup.locator('#add-account-button').click();
  await popup.locator('#email-input').fill(email);
  await popup.locator('#display-name-input').fill(name);
  await popup.locator('#sign-in').click();
}

test.beforeEach(async ({ page }) => {
  await dismissStorageNotice(page);
});

// PLAN 2.1: the one test that does not use the shortcut of the others (`signInHere`): the
// button, the window, the session it brings back and where the app goes with it.
test('"Continuar con Google" opens the window, creates the account and asks for the terms', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const email = `ventana-${uniqueTag(testInfo)}@example.com`;
  await page.goto('/ingresar?desde=%2Fpedidos');
  await expect(heading(page)).toHaveText('Ingresa a Hornilla.');
  // Nothing to type on the screen itself: Google is the only way in.
  await expect(page.getByRole('main').getByRole('textbox')).toHaveCount(0);

  await continueWithGoogle(page, email, 'V. Ventana');

  // A first sign-in: the account exists, the profile waits for the acceptance.
  await expect(page).toHaveURL(/\/aceptar-terminos$/);
  await expect(page.getByLabel('Nombre', { exact: true })).toHaveValue('V. Ventana');
  const account = await findAuthAccount(email);
  expect(account?.emailVerified).toBe(true);
  expect(await readDocument(`users/${account?.localId}`)).toBeNull();

  await page.getByRole('checkbox', { name: /Acepto los Términos y condiciones/ }).check();
  await page.getByRole('checkbox', { name: /Leí la Política de privacidad/ }).check();
  await page.getByRole('button', { name: 'Aceptar y continuar' }).click();

  // And then on to where the person was going before being asked to sign in.
  await expect(page).toHaveURL(/\/pedidos$/);
  expect(await readDocument(`users/${account?.localId}`)).toMatchObject({
    displayName: 'V. Ventana',
  });
  expect(errors).toEqual([]);
});

test('closing the window of Google says so and leaves the visitor where it was', async ({
  page,
}) => {
  await page.goto('/ingresar');
  const popup = await openGoogleWindow(page);
  await popup.locator('#add-account-button').waitFor();

  await popup.close();

  await expect(page.getByText('Se canceló el ingreso.')).toBeVisible();
  await expect(page).toHaveURL(/\/ingresar$/);
  await expect(page.getByRole('button', { name: 'Continuar con Google' })).toBeEnabled();
});

// PLAN 2.1: `/registro` is the same screen with other words.
test('"Crear cuenta" is the same way in, under its own title', async ({ page }) => {
  await page.goto('/registro');

  await expect(heading(page)).toHaveText('Crea tu cuenta en Hornilla.');
  await expect(page.getByRole('button', { name: 'Continuar con Google' })).toBeVisible();
  await expect(page.getByRole('main').getByRole('textbox')).toHaveCount(0);
  await expect(page.getByText(/^Necesitas una cuenta de Google: es la única forma/)).toBeVisible();
  await expect(
    page.getByText(/se aceptan en el paso siguiente, la primera vez que ingresas; si no los/),
  ).toBeVisible();
  const main = page.getByRole('main');
  await expect(main.getByRole('link', { name: /Términos y condiciones/ })).toBeVisible();
  await expect(main.getByRole('link', { name: /Política de privacidad/ })).toBeVisible();
});

// PLAN 2.1, §11 (2026-10-14): one way in. The header offers "Ingresar" elsewhere and nothing on
// the two entry screens, which do not link to each other: it would be the same button again.
test('there is one door: "Ingresar" in the header, and no crossing between the entry screens', async ({
  page,
}) => {
  await page.goto('/');
  const header = page.getByRole('banner');
  await expect(header.getByRole('link', { name: 'Ingresar' })).toBeVisible();
  await expect(header.getByRole('link', { name: 'Crear cuenta' })).toHaveCount(0);

  for (const path of ['/ingresar', '/registro']) {
    await page.goto(path);
    await expect(page.getByRole('button', { name: 'Continuar con Google' })).toBeVisible();
    for (const name of ['Ingresar', 'Crear cuenta']) {
      await expect(header.getByRole('link', { name })).toHaveCount(0);
      await expect(page.getByRole('main').getByRole('link', { name })).toHaveCount(0);
    }
  }
});

// PLAN 2.1: the screens of the password are gone, with or without a session.
for (const path of ['/restablecer', '/verificar-correo']) {
  test(`${path} no longer exists`, async ({ page }) => {
    await page.goto(path);

    await expect(heading(page)).toContainText('no existe');
    await expect(page.getByRole('button', { name: 'Continuar con Google' })).toHaveCount(0);
  });
}
