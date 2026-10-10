import { expect, test } from '@playwright/test';
import { SEED_PASSWORD } from '../seed/data';
import { dismissStorageNotice } from './support/storage-notice';

test.skip(
  process.env.E2E_EMULATORS !== 'true',
  'Needs the seeded emulators: run with E2E_EMULATORS=true',
);

const TERMS_BOX = /Acepto los Términos y condiciones/;
const PRIVACY_BOX = /Leí la Política de privacidad/;

// PLAN 2.1, 2.9: registration with the two consent boxes, up to the "verify your e-mail" step.
test('a new person registers only after ticking both boxes', async ({ page }, testInfo) => {
  // Its own address on every run: the test leaves the seeded accounts alone.
  const email = `registro-${testInfo.project.name}-${Date.now()}@example.com`;
  await dismissStorageNotice(page);
  await page.goto('/registro');

  await page.getByLabel('Nombre', { exact: true }).fill('N. Registro');
  await page.getByLabel('Correo', { exact: true }).fill(email);
  await page.getByLabel('Contraseña', { exact: true }).fill(SEED_PASSWORD);
  await expect(page.getByRole('checkbox', { name: TERMS_BOX })).not.toBeChecked();
  await expect(page.getByRole('checkbox', { name: PRIVACY_BOX })).not.toBeChecked();
  await expect(page.getByText('Versión 0.1, preliminar y en revisión.')).toBeVisible();

  // Without the boxes nothing is sent: each one says what is missing.
  await page.getByRole('button', { name: 'Crear cuenta', exact: true }).click();
  await expect(
    page.getByText('Marca esta casilla para aceptar los términos y continuar.'),
  ).toBeVisible();
  await expect(
    page.getByText('Marca esta casilla para autorizar el uso de tus datos y continuar.'),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/registro$/);

  // With only the first one, the second is still asked for.
  await page.getByRole('checkbox', { name: TERMS_BOX }).check();
  await page.getByRole('button', { name: 'Crear cuenta', exact: true }).click();
  await expect(
    page.getByText('Marca esta casilla para autorizar el uso de tus datos y continuar.'),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/registro$/);

  await page.getByRole('checkbox', { name: PRIVACY_BOX }).check();
  await page.getByRole('button', { name: 'Crear cuenta', exact: true }).click();

  await expect(page).toHaveURL(/\/verificar-correo$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Verifica tu correo.');
  await expect(page.getByText(email)).toBeVisible();
});

// PLAN 2.9: the header never offers the screen the visitor is already on.
test('the header offers the other screen, not the current one', async ({ page }) => {
  await dismissStorageNotice(page);

  await page.goto('/registro');
  const header = page.getByRole('banner');
  await expect(header.getByRole('link', { name: 'Ingresar' })).toBeVisible();
  await expect(header.getByRole('link', { name: 'Crear cuenta' })).toHaveCount(0);

  await page.goto('/ingresar');
  await expect(header.getByRole('link', { name: 'Crear cuenta' })).toBeVisible();
  await expect(header.getByRole('link', { name: 'Ingresar' })).toHaveCount(0);
});
