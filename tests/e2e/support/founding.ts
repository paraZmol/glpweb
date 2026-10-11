import { expect, type Page } from '@playwright/test';

export const FOUNDING_PATH = '/distribuidora/nueva';
export const FOUNDING_TERMS_BOX = /en nombre de esta distribuidora/;
export const FOUNDING_AUTHORITY_BOX = /Declaro que puedo representar a este negocio/;
export const CREATE_BUTTON = 'Crear mi distribuidora';

/** Follows the fake pattern 9000000xx of the seed. */
const BUSINESS_PHONE = '900000098';
/**
 * Far from every seeded plant and from the points the finder tests search from: what a test
 * founds here never shows up in the searches of another test.
 */
export const FOUNDING_PLANT = { latitude: '-5.2', longitude: '-80.63', address: 'Av. Ensayo 700' };

/**
 * The business verification data the founding requires since PLAN 2.11, and the labels the
 * wizard gives its three fields (step "Negocio"). The RUC is invented: prefix 20, zeros and
 * the check digit that follows from them.
 */
export const FOUNDING_VERIFICATION = {
  taxIdLabel: 'RUC',
  taxId: '20000000001',
  legalNameLabel: 'Razón social o nombre del titular',
  legalName: 'Gas Ensayo S.A.C.',
  registryLabel: 'Número de ficha del Registro de Hidrocarburos',
  registry: '00000-074-000099',
};

export interface FoundingAnswers {
  name: string;
  slug: string;
}

const next = (page: Page) => page.getByRole('button', { name: 'Continuar' }).click();
const stepHeading = (page: Page) => page.getByRole('heading', { level: 1 });

/**
 * Walks the sign-up wizard of a distributor (PLAN 2.2) from its first step to the last one,
 * with both declarations ticked, and stops BEFORE sending: the test decides when to press
 * "Crear mi distribuidora". The page must already be on `/distribuidora/nueva`.
 */
export async function fillFoundingWizard(page: Page, { name, slug }: FoundingAnswers) {
  await page.getByLabel('Nombre de la distribuidora').fill(name);
  await page.getByLabel('Enlace de tu página').fill(slug);
  await expect(page.getByText('Está libre.')).toBeVisible();
  await page.getByLabel('Teléfono del negocio').fill(BUSINESS_PHONE);
  await page.getByLabel(FOUNDING_VERIFICATION.taxIdLabel).fill(FOUNDING_VERIFICATION.taxId);
  await page.getByLabel(FOUNDING_VERIFICATION.legalNameLabel).fill(FOUNDING_VERIFICATION.legalName);
  await page.getByLabel(FOUNDING_VERIFICATION.registryLabel).fill(FOUNDING_VERIFICATION.registry);
  await next(page);

  await expect(stepHeading(page)).toContainText('tu planta.');
  await page.getByLabel('Latitud').fill(FOUNDING_PLANT.latitude);
  await page.getByLabel('Longitud').fill(FOUNDING_PLANT.longitude);
  await page.getByLabel(/Dirección de la planta/).fill(FOUNDING_PLANT.address);
  await next(page);

  await expect(stepHeading(page)).toContainText('tu color.');
  await next(page);

  await expect(stepHeading(page)).toContainText('crea tu distribuidora.');
  await page.getByRole('checkbox', { name: FOUNDING_TERMS_BOX }).check();
  await page.getByRole('checkbox', { name: FOUNDING_AUTHORITY_BOX }).check();
}

/** The whole sign-up, until the new owner stands on the office of the new distributor. */
export async function foundDistributor(page: Page, answers: FoundingAnswers) {
  await page.goto(FOUNDING_PATH);
  await fillFoundingWizard(page, answers);
  await page.getByRole('button', { name: CREATE_BUTTON }).click();
  await expect(page).toHaveURL(/\/central$/);
  await expect(stepHeading(page)).toHaveText(`Hoy en ${answers.name}.`);
}
