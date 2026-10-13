import { expect, type Page, test } from '@playwright/test';
import {
  createTestAccount,
  findAuthAccount,
  readDocument,
  type TestProfile,
  uniqueTag,
} from '../support/emulator-admin';
import { expectDeviceCleared } from '../support/device-storage';
import { signInAs, signInHere } from '../support/sign-in';
import { dismissStorageNotice } from '../support/storage-notice';

test.skip(
  process.env.E2E_EMULATORS !== 'true',
  'Needs the seeded emulators: run with E2E_EMULATORS=true',
);

const TERMS_BOX = /Acepto los Términos y condiciones/;
const PRIVACY_BOX = /Leí la Política de privacidad/;
const CURRENT_TERMS = '0.4';
const CURRENT_PRIVACY = '0.4';
/** Every signed-in address somebody could type to skip a pending step. */
const WAYS_AROUND = ['/inicio', '/pedidos', '/cuenta', '/distribuidora/nueva', '/central', '/app'];
const DISCARD = 'No quiero continuar: eliminar mi cuenta';
const UNCONFIRMED = 'No pudimos confirmar tu correo con Google.';

const heading = (page: Page) => page.getByRole('heading', { level: 1 });

// Each flow types several addresses, and every one of them loads the app again.
test.slow();

test.beforeEach(async ({ page }) => {
  await dismissStorageNotice(page);
});

// PLAN 2.1, 2.4: sign-in is with Google only and Google confirms the address, so a session
// without a confirmed e-mail should not exist. If one does, no screen with a session opens for
// it — even with a profile on record — and the only thing it can do is leave.
test('a session without a confirmed e-mail gets no screen, whatever address it types', async ({
  page,
}, testInfo) => {
  const account = await createTestAccount(uniqueTag(testInfo), { emailVerified: false });
  await signInAs(page, account, '/app');
  await expect(page.getByRole('heading', { name: UNCONFIRMED })).toBeVisible();
  await expect(page.getByText('Cierra sesión e inténtalo de nuevo.')).toBeVisible();

  for (const path of [...WAYS_AROUND, '/aceptar-terminos', '/plataforma', '/reparto']) {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: UNCONFIRMED }), `typing ${path}`).toBeVisible();
    await expect(page.getByText(/Hola/)).toHaveCount(0);
    await expect(page.getByRole('navigation')).toHaveCount(0);
  }

  // The way out works, and leaves nothing of the session on the device.
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('banner').getByRole('link', { name: 'Ingresar' })).toBeVisible();
  await expectDeviceCleared(page);
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
    await signInAs(page, account, '/aceptar-terminos');
    await expect(heading(page)).toHaveText(title);
    await expect(page.getByRole('checkbox', { name: TERMS_BOX })).not.toBeChecked();
    await expect(page.getByRole('checkbox', { name: PRIVACY_BOX })).not.toBeChecked();

    for (const path of WAYS_AROUND) {
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
      terms: { version: CURRENT_TERMS },
      privacy: { version: CURRENT_PRIVACY },
    });
    await page.goto('/aceptar-terminos');
    await expect(page).toHaveURL(/\/inicio$/);
  });
}

// PLAN 2.9: whoever does not accept can leave, and the account goes with them.
test('"No quiero continuar" deletes the account that never accepted and returns to the home', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const account = await createTestAccount(uniqueTag(testInfo), { profile: 'none' });
  await signInAs(page, account, '/aceptar-terminos');

  // It asks once more, and "Cancelar" keeps the account.
  await page.getByRole('button', { name: DISCARD }).click();
  const confirmation = page.getByRole('group', { name: '¿Eliminar tu cuenta?' });
  await confirmation.getByRole('button', { name: 'Cancelar' }).click();
  expect(await findAuthAccount(account.email)).not.toBeNull();

  await page.getByRole('button', { name: DISCARD }).click();
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
  // The account is gone for real: the same person coming back starts from nothing, as the
  // confirmation said they could.
  await page.goto('/ingresar');
  await signInHere(page, account);
  await expect(page).toHaveURL(/\/aceptar-terminos$/);
  const again = await findAuthAccount(account.email);
  expect(again?.localId).not.toBe(account.uid);
  expect(await readDocument(`users/${again?.localId}`)).toBeNull();
});

// PLAN 2.11: an account that already accepted has data, so it cannot be thrown away from this
// screen. It is not offered a button that would only refuse: "No acepto" leads to where the
// deletion is asked for.
test('"No acepto" sends an account that already has a profile to ask for its deletion', async ({
  page,
}, testInfo) => {
  const account = await createTestAccount(uniqueTag(testInfo), { profile: 'outdated' });
  await signInAs(page, account, '/aceptar-terminos');

  await expect(page.getByRole('button', { name: DISCARD })).toHaveCount(0);
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
