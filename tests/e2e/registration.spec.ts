import { expect, test } from '@playwright/test';
import { SEED_PASSWORD } from '../seed/data';
import { dismissStorageNotice } from './support/storage-notice';

test.skip(
  process.env.E2E_EMULATORS !== 'true',
  'Needs the seeded emulators: run with E2E_EMULATORS=true',
);

const NEXT_STEP_NOTE =
  /se aceptan en el paso siguiente, después de verificar tu correo\. Hasta entonces no guardamos tu nombre ni tu celular\./;

// PLAN 2.1, 2.11: registering creates the account and asks for no consent: the terms are
// accepted after the e-mail is verified. Up to the "verify your e-mail" step.
test('a new person registers without ticking anything and is told where the terms are accepted', async ({
  page,
}, testInfo) => {
  // Its own address on every run: the test leaves the seeded accounts alone.
  const email = `registro-${testInfo.project.name}-${Date.now()}@example.com`;
  await dismissStorageNotice(page);
  await page.goto('/registro');

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Crea tu cuenta en Hornilla.');
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  await expect(page.getByText(NEXT_STEP_NOTE)).toBeVisible();
  const form = page.locator('form');
  await expect(form.getByRole('link', { name: /Términos y condiciones/ })).toBeVisible();
  await expect(form.getByRole('link', { name: /Política de privacidad/ })).toBeVisible();

  // An incomplete form is not sent: each field says what is missing.
  await page.getByRole('button', { name: 'Crear cuenta', exact: true }).click();
  await expect(page.getByText('Escribe tu nombre.')).toBeVisible();
  await expect(page).toHaveURL(/\/registro$/);

  await page.getByLabel('Nombre', { exact: true }).fill('N. Registro');
  await page.getByLabel('Correo', { exact: true }).fill(email);
  await page.getByLabel('Contraseña', { exact: true }).fill(SEED_PASSWORD);
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
