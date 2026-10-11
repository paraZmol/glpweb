// role-walker
// What a person found in the first minutes of using the built app, role by role, on the pass
// of 2026-10-11 (docs/testing/matriz-de-roles.md). Each test describes the behaviour a person
// expects. The ones the app does not do yet are marked `test.fail` with the reason: the day the
// app is fixed the test turns "unexpectedly passing" and the mark is removed. Fixed since then
// (their tests stay as plain tests): the back button in the sign-up of a distributor, the
// storage notice over "Guardar cambios", the answer of /restablecer, the 404 page with a session
// and the password of spaces.
import { expect, type Page } from '@playwright/test';
import { type Actors, DESKTOP, PHONE, test } from '../support/actors';
import { createTestAccount, readDocument, uniqueTag } from '../support/emulator-admin';
import { foundDistributor, FOUNDING_PATH, FOUNDING_VERIFICATION } from '../support/founding';
import { signInAsSeedUser, signInWithPassword } from '../support/sign-in';
import { dismissStorageNotice } from '../support/storage-notice';

test.skip(
  process.env.E2E_EMULATORS !== 'true',
  'Needs the seeded emulators: run with E2E_EMULATORS=true',
);
// Most of these found a distributor through the screen before the part that matters.
test.slow();

const heading = (page: Page) => page.getByRole('heading', { level: 1 });
/** Follows the fake pattern 9000000xx of the seed. */
const BUSINESS_PHONE = '900000097';
const OTHER_PHONE = '900000096';

/** Fills the first step of the sign-up of a distributor and leaves the wizard on the second. */
async function reachSecondStep(page: Page, name: string, slug: string): Promise<void> {
  await page.goto(FOUNDING_PATH);
  await page.getByLabel('Nombre de la distribuidora').fill(name);
  await page.getByLabel('Enlace de tu página').fill(slug);
  await expect(page.getByText('Está libre.')).toBeVisible();
  await page.getByLabel('Teléfono del negocio').fill(BUSINESS_PHONE);
  await page.getByLabel(FOUNDING_VERIFICATION.taxIdLabel).fill(FOUNDING_VERIFICATION.taxId);
  await page.getByLabel(FOUNDING_VERIFICATION.legalNameLabel).fill(FOUNDING_VERIFICATION.legalName);
  await page.getByLabel(FOUNDING_VERIFICATION.registryLabel).fill(FOUNDING_VERIFICATION.registry);
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(heading(page)).toContainText('tu planta.');
}

/** An account of its own that founded a distributor through the screen, standing on its office. */
async function foundedOffice(actors: Actors, tag: string) {
  const account = await createTestAccount(tag);
  const name = `Gas Recorrido ${tag}`;
  const slug = `recorrido-${tag}`;
  const owner = await actors.open(DESKTOP);
  await signInWithPassword(owner.page, account.email, '/inicio');
  await foundDistributor(owner.page, { name, slug });
  const link = await readDocument(`slugs/${slug}`);
  return { account, name, slug, owner, id: String(link?.distributorId) };
}

test.describe('sign-up of a distributor: what is typed survives the browser', () => {
  test.beforeEach(async ({ page }) => {
    await dismissStorageNotice(page);
  });

  // PLAN 2.2. ALTO: the back gesture of a phone is how people go to the previous step.
  test('the back button of the browser returns to the previous step with its data', async ({
    page,
  }, testInfo) => {
    const tag = uniqueTag(testInfo);
    const account = await createTestAccount(tag);
    await signInWithPassword(page, account.email, '/inicio');
    await reachSecondStep(page, `Gas Atrás ${tag}`, `atras-${tag}`);

    await page.goBack();

    await expect(page).toHaveURL(new RegExp(`${FOUNDING_PATH}$`));
    await expect(page.getByLabel('Nombre de la distribuidora')).toHaveValue(`Gas Atrás ${tag}`);
  });

  // PLAN 2.2. MEDIO: step 2 sends the person to their maps app to copy two numbers; a phone
  // that reloads the tab on the way back empties eleven answers.
  test('reloading the tab in the middle of the wizard keeps what was typed', async ({
    page,
  }, testInfo) => {
    test.fail(
      true,
      'role-walker 2026-10-11: a reload on step 2 returns to an empty step 1 (only "Tu celular" comes back, from the profile)',
    );
    const tag = uniqueTag(testInfo);
    const account = await createTestAccount(tag);
    await signInWithPassword(page, account.email, '/inicio');
    await reachSecondStep(page, `Gas Recarga ${tag}`, `recarga-${tag}`);

    await page.reload();

    // The wizard reopens where it was, and going back shows the first step as it was left.
    await expect(heading(page)).toContainText('tu planta.');
    await page.getByRole('button', { name: 'Atrás' }).click();
    await expect(page.getByLabel('Nombre de la distribuidora')).toHaveValue(`Gas Recarga ${tag}`);
  });
});

test.describe('review of a listing with two people at once', () => {
  test.skip(({ isMobile }) => isMobile, 'Each actor opens its own device: runs once, on desktop');

  // PLAN 2.11. ALTO: the approval is the only brake on a false listing, and it says "Hornilla
  // reviewed what was declared". Here it approves a name and a phone nobody reviewed.
  test('the platform cannot approve a listing that changed after its review was opened', async ({
    actors,
  }, testInfo) => {
    test.fail(
      true,
      'role-walker 2026-10-11: the review screen does not notice the edit of the owner; "Aprobar" publishes the new name and phone, which the admin never saw',
    );
    const { id, owner } = await foundedOffice(actors, uniqueTag(testInfo));
    const admin = await actors.openSeed('admin');
    const changedName = `Gas Cambiado ${uniqueTag(testInfo)}`;
    await admin.page.goto(`/plataforma/altas/${id}`);
    await expect(admin.page.getByRole('button', { name: 'Aprobar' })).toBeVisible();

    await owner.page.goto('/central/ficha');
    await owner.page.getByLabel('Nombre de la distribuidora').fill(changedName);
    await owner.page.getByLabel('Teléfono del negocio').fill(OTHER_PHONE);
    await owner.page.getByRole('button', { name: 'Guardar cambios' }).click();
    await expect(owner.page).toHaveURL(/\/central$/);
    // The admin decides on what is on the screen, without reloading.
    await admin.page.getByRole('button', { name: 'Aprobar' }).click();
    await admin.page.getByRole('button', { name: 'Sí, aprobar' }).click();
    // The screen ends up showing the new name either way: by then the decision was taken.
    await expect(admin.page.getByText(changedName).first()).toBeVisible();

    const control = await readDocument(`distributors/${id}/private/control`);
    const listing = await readDocument(`distributors/${id}`);
    expect(listing?.name).toBe(changedName);
    expect(control?.listingApproved, 'approved a name the admin never saw').not.toBe(true);
    expect([...owner.errors, ...admin.errors]).toEqual([]);
  });

  // PLAN 2.11. MEDIO: the owner waits for the review looking at this panel.
  test('the office of the owner shows the approval without reloading the page', async ({
    actors,
  }, testInfo) => {
    test.fail(
      true,
      'role-walker 2026-10-11: the status of the listing is read once; the open office keeps saying "En revisión" after the approval (and shows no note after "Pedir cambios") until the page is reloaded',
    );
    const { id, owner } = await foundedOffice(actors, uniqueTag(testInfo));
    const admin = await actors.openSeed('admin');
    await admin.page.goto(`/plataforma/altas/${id}`);
    await admin.page.getByRole('button', { name: 'Aprobar' }).click();
    await admin.page.getByRole('button', { name: 'Sí, aprobar' }).click();
    await expect(admin.page.getByText('Ficha aprobada.')).toBeVisible();

    // The owner never left the office and never reloaded it.
    await expect(owner.page.getByRole('button', { name: 'Copiar enlace' })).toBeVisible();
    await expect(owner.page.getByText('En revisión', { exact: true })).toHaveCount(0);
  });

  // MEDIO. Every other browser test marks the storage notice as read before the first screen
  // (`dismissStorageNotice`), so none of them sees what a person sees on a first visit.
  test('on a phone the storage notice does not cover the button that saves the listing', async ({
    actors,
    browser,
  }, testInfo) => {
    const { account } = await foundedOffice(actors, uniqueTag(testInfo));
    // A phone that never saw the app: the notice is on the screen.
    const context = await browser.newContext(PHONE);
    try {
      const page = await context.newPage();
      await signInWithPassword(page, account.email, '/central');
      await page.goto('/central/ficha');
      await expect(page.getByRole('region', { name: 'Aviso de almacenamiento' })).toBeVisible();
      await page.getByLabel('Dirección de la planta').fill('Av. Ensayo 701');

      await page.getByRole('button', { name: 'Guardar cambios' }).click({ timeout: 10_000 });

      await expect(page).toHaveURL(/\/central$/);
    } finally {
      await context.close();
    }
  });
});

test.describe('small things a person meets on the way', () => {
  test.beforeEach(async ({ page }) => {
    await dismissStorageNotice(page);
  });

  // PLAN 2.1. MEDIO: the screen has no password, and the answer tells apart the addresses
  // that have an account from the ones that do not.
  test('asking to reset the password of an unknown address answers like a known one', async ({
    page,
  }, testInfo) => {
    await page.goto('/restablecer');
    await page
      .getByLabel('Correo', { exact: true })
      .fill(`nadie-${uniqueTag(testInfo)}@example.com`);

    await page.getByRole('button', { name: 'Enviar enlace' }).click();

    await expect(heading(page)).toContainText('Revisa tu correo');
  });

  // PLAN 2.4. BAJO.
  test('the "not found" page does not offer "Ingresar" to somebody already signed in', async ({
    page,
  }) => {
    await signInAsSeedUser(page, 'customer');

    await page.goto('/una-pagina-que-no-existe');

    await expect(heading(page)).toContainText('no existe');
    await expect(page.getByRole('main').getByRole('link', { name: 'Ingresar' })).toHaveCount(0);
  });

  // PLAN 2.1. BAJO.
  test('the registration refuses a password made only of spaces', async ({ page }, testInfo) => {
    await page.goto('/registro');
    await page.getByLabel('Nombre', { exact: true }).fill('Z. Prueba');
    await page
      .getByLabel('Correo', { exact: true })
      .fill(`espacios-${uniqueTag(testInfo)}@example.com`);
    await page.getByLabel('Contraseña', { exact: true }).fill(' '.repeat(8));

    await page.getByRole('button', { name: 'Crear cuenta', exact: true }).click();

    await expect(page.getByLabel('Contraseña', { exact: true })).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    await expect(page).toHaveURL(/\/registro$/);
  });
});
