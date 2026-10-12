import { expect, test } from '@playwright/test';
import { SEED_DISTRIBUTORS, SEED_PASSWORD, SEED_USERS } from '../seed/data';
import { FOUNDING_VERIFICATION } from './support/founding';
import { dismissStorageNotice } from './support/storage-notice';

test.skip(
  process.env.E2E_EMULATORS !== 'true',
  'Needs the seeded emulators: run with E2E_EMULATORS=true',
);

const TERMS_BOX = /en nombre de esta distribuidora/;
const AUTHORITY_BOX = /Declaro que puedo representar a este negocio/;
/** Another city: what this test founds never shows up in the searches of other tests. */
const PLANT = { latitude: '-8.1', longitude: '-79.03' };
/** Eleven digits and a known prefix, but the check digit of another number. */
const MISTYPED_TAX_ID = '20000000002';

// PLAN 2.2, 2.11: sign-up of a distributor from start to end, with a verified seeded account.
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

  // PLAN 2.11: the three data Hornilla reviews. They are private and the screen says so; a
  // RUC whose check digit does not match is refused before anything is sent.
  await expect(
    page.getByText(
      'Estos tres datos no se publican. Hornilla los usa para revisar tu distribuidora antes de mostrarla; solo los ven tú y la administración de Hornilla. El detalle está en la Política de privacidad',
    ),
  ).toBeVisible();
  await expect(page.getByText('Escribe el RUC del negocio.')).toBeVisible();
  await page.getByLabel(FOUNDING_VERIFICATION.taxIdLabel).fill(MISTYPED_TAX_ID);
  await page.getByLabel(FOUNDING_VERIFICATION.legalNameLabel).fill(FOUNDING_VERIFICATION.legalName);
  await page.getByLabel(FOUNDING_VERIFICATION.registryLabel).fill(FOUNDING_VERIFICATION.registry);
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.getByText('Revisa el RUC: son 11 dígitos y alguno no coincide.')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('tu negocio.');
  await page.getByLabel(FOUNDING_VERIFICATION.taxIdLabel).fill(FOUNDING_VERIFICATION.taxId);
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

  // Step 4: review. What becomes public is said (the private data is not in the summary), so
  // is what happens next, and both boxes start unticked.
  await expect(page.getByRole('heading', { level: 1 })).toContainText('crea tu distribuidora.');
  await expect(
    page.getByText(
      'Es público: nombre, enlace, teléfono, WhatsApp, dirección y ubicación de la planta. No es público: tu celular, tu RUC, tu razón social y tu número de registro.',
    ),
  ).toBeVisible();
  await expect(page.getByText(FOUNDING_VERIFICATION.taxId)).toHaveCount(0);
  // One block, three points; the trial is said once, with what happens when it ends.
  const comesNext = page.getByRole('region', { name: 'Qué pasa ahora' }).getByRole('listitem');
  await expect(comesNext).toHaveText([
    'Tu distribuidora se crea ahora y puedes configurarla de inmediato.',
    'Aparece en el buscador cuando Hornilla revise sus datos. Revisar no es certificar: lo que declaras sigue siendo tu responsabilidad.',
    '30 días de prueba gratis desde hoy, también durante la revisión. No pedimos tarjeta y no hay ningún cobro al terminar. El precio de cada plan se informa antes de contratarlo; si al terminar la prueba no tienes un plan, tu panel queda en solo lectura y tu página deja de verse.',
  ]);
  // The plant shows by its address: raw coordinates tell the founder nothing.
  await expect(page.getByText('Av. Muestra 500', { exact: true })).toBeVisible();
  await expect(page.getByText(PLANT.latitude)).toHaveCount(0);
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
  // PLAN 2.11: it waits for the review of the platform, and the office says so.
  await expect(page.getByText('En revisión', { exact: true })).toBeVisible();
  await expect(page.getByText(/tus clientes todavía no te ven\./)).toBeVisible();

  // Its page exists with what was typed, and for now only its own staff opens it.
  await page.getByRole('link', { name: 'Ver mi página' }).click();
  await expect(page).toHaveURL(new RegExp(`/d/${slug}$`));
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(name);
  await expect(
    page.getByText('Solo el personal de tu distribuidora ve esta página: ahora no es pública.'),
  ).toBeVisible();
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
  await page.getByLabel(FOUNDING_VERIFICATION.taxIdLabel).fill(FOUNDING_VERIFICATION.taxId);
  await page.getByLabel(FOUNDING_VERIFICATION.legalNameLabel).fill(FOUNDING_VERIFICATION.legalName);
  await page.getByLabel(FOUNDING_VERIFICATION.registryLabel).fill(FOUNDING_VERIFICATION.registry);
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('tu planta.');

  await page.getByRole('button', { name: 'Atrás' }).click();

  await expect(page.getByLabel('Nombre de la distribuidora')).toHaveValue('Gas Ida y Vuelta');
  await expect(page.getByLabel('Enlace de tu página')).toHaveValue('gas-ida-y-vuelta');
  await expect(page.getByLabel(FOUNDING_VERIFICATION.taxIdLabel)).toHaveValue(
    FOUNDING_VERIFICATION.taxId,
  );
  await expect(page.getByLabel(FOUNDING_VERIFICATION.registryLabel)).toHaveValue(
    FOUNDING_VERIFICATION.registry,
  );
});
