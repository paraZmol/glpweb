import { expect, test } from '@playwright/test';
import { SEED_DISTRIBUTORS, SEED_PASSWORD, SEED_USERS } from '../seed/data';
import { dismissStorageNotice } from './support/storage-notice';

test.skip(
  process.env.E2E_EMULATORS !== 'true',
  'Needs the seeded emulators: run with E2E_EMULATORS=true',
);

const TERMS_BOX = /en nombre de esta distribuidora/;
const AUTHORITY_BOX = /Declaro que puedo representar a este negocio/;
/** Another city: what this test founds never shows up in the searches of other tests. */
const PLANT = { latitude: '-8.1', longitude: '-79.03' };

// PLAN 2.2: sign-up of a distributor from start to end, with a verified seeded account.
test('a verified account founds a distributor and lands on its office', async ({
  page,
}, testInfo) => {
  // Each run founds its own distributor: unique name and link per project and moment.
  const tag = `${testInfo.project.name}-${Date.now().toString(36)}`;
  const name = `Gas Alta ${tag}`;
  const slug = `gas-alta-${tag}`;
  await dismissStorageNotice(page);

  // By hand, not with the helper: once it has founded, this account lands on its office.
  await page.goto('/ingresar?desde=%2Fdistribuidora%2Fnueva');
  await page.getByLabel('Correo', { exact: true }).fill(SEED_USERS.founder.email);
  await page.getByLabel('Contraseña', { exact: true }).fill(SEED_PASSWORD);
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
  await expect(page).toHaveURL(/\/distribuidora\/nueva$/);

  // Step 1: business. The link is proposed from the name and checked while typing.
  await expect(page.getByRole('progressbar', { name: 'Avance del registro' })).toHaveAttribute(
    'aria-valuetext',
    'Paso 1 de 4: Negocio',
  );
  await page.getByLabel('Nombre de la distribuidora').fill(name);
  await expect(page.getByLabel('Enlace de tu página')).toHaveValue(slug);
  await expect(page.getByText('Está libre.')).toBeVisible();
  await page.getByLabel('Enlace de tu página').fill(SEED_DISTRIBUTORS.a.slug);
  await expect(page.getByText('Ya lo usa otra distribuidora. Prueba con otro.')).toBeVisible();
  await page.getByLabel('Teléfono del negocio').fill('900000091');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.getByText('Ese enlace ya lo usa otra distribuidora.')).toBeVisible();
  await page.getByLabel('Enlace de tu página').fill(slug);
  await expect(page.getByText('Está libre.')).toBeVisible();
  await page.getByRole('button', { name: 'Continuar' }).click();

  // Step 2: plant and coverage. Without a point it does not go on.
  await expect(page.getByRole('heading', { level: 1 })).toContainText('tu planta.');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.getByText(/Indica dónde está la planta/)).toBeVisible();
  await page.getByLabel('Latitud').fill(PLANT.latitude);
  await page.getByLabel('Longitud').fill(PLANT.longitude);
  await page.getByLabel(/Dirección de la planta/).fill('Av. Muestra 500');
  await page.getByRole('button', { name: 'Ampliar el radio un kilómetro' }).click();
  await expect(page.getByRole('group', { name: 'Radio de cobertura' })).toContainText('6 km');
  await page.getByRole('button', { name: 'Continuar' }).click();

  // Step 3: brand. A colour too faint is explained and the closest tone is offered.
  await expect(page.getByRole('heading', { level: 1 })).toContainText('tu color.');
  await page.getByLabel('O escribe tu color').fill('#ffe600');
  await expect(page.getByText(/casi no se distingue del fondo blanco/)).toBeVisible();
  await page.getByRole('button', { name: 'Usar este tono' }).click();
  await expect(page.getByText(/casi no se distingue/)).toHaveCount(0);
  await page.getByRole('radio', { name: 'Rojo rocoto' }).click();
  await page.getByRole('button', { name: 'Continuar' }).click();

  // Step 4: review. What becomes public is said, and both boxes start unticked.
  await expect(page.getByRole('heading', { level: 1 })).toContainText('crea tu distribuidora.');
  await expect(
    page.getByText(
      'El nombre, el teléfono, el WhatsApp, la dirección y la ubicación de la planta serán públicos.',
    ),
  ).toBeVisible();
  await expect(page.getByText('30 días de prueba gratis. Después eliges un plan.')).toBeVisible();
  await expect(page.getByRole('checkbox', { name: TERMS_BOX })).not.toBeChecked();
  await expect(page.getByRole('checkbox', { name: AUTHORITY_BOX })).not.toBeChecked();
  await page.getByRole('button', { name: 'Crear mi distribuidora' }).click();
  await expect(page.getByText('Debes aceptar los términos para continuar.')).toBeVisible();
  await expect(page).toHaveURL(/\/distribuidora\/nueva$/);
  await page.getByRole('checkbox', { name: TERMS_BOX }).check();
  await page.getByRole('checkbox', { name: AUTHORITY_BOX }).check();
  await page.getByRole('button', { name: 'Crear mi distribuidora' }).click();

  // The founder is now the owner: the office welcomes it and says what comes next.
  await expect(page).toHaveURL(/\/central$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(`Hoy en ${name}.`);
  await expect(page.getByText(`${name} ya está en Hornilla.`)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Completa tu distribuidora' })).toBeVisible();
  await expect(page.getByText('Llega pronto')).toHaveCount(2);
  await expect(page.getByText(/Prueba gratis · quedan 30 días/)).toBeVisible();

  // And its public page exists, with what was typed.
  await page.getByRole('link', { name: 'Ver mi página' }).click();
  await expect(page).toHaveURL(new RegExp(`/d/${slug}$`));
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(name);
  await expect(page.getByText('6 km', { exact: true })).toBeVisible();
});

test('the wizard keeps what was typed when going back a step', async ({ page }) => {
  await dismissStorageNotice(page);
  await page.goto('/ingresar?desde=%2Fdistribuidora%2Fnueva');
  await page.getByLabel('Correo', { exact: true }).fill(SEED_USERS.customer.email);
  await page.getByLabel('Contraseña', { exact: true }).fill(SEED_PASSWORD);
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
  await expect(page).toHaveURL(/\/distribuidora\/nueva$/);

  await page.getByLabel('Nombre de la distribuidora').fill('Gas Ida y Vuelta');
  await page.getByLabel('Teléfono del negocio').fill('900000092');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('tu planta.');

  await page.getByRole('button', { name: 'Atrás' }).click();

  await expect(page.getByLabel('Nombre de la distribuidora')).toHaveValue('Gas Ida y Vuelta');
  await expect(page.getByLabel('Enlace de tu página')).toHaveValue('gas-ida-y-vuelta');
});
