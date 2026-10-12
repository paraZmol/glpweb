// role-walker
// What a person found in the first minutes of using the built app, role by role, on the pass
// of 2026-10-11 (docs/testing/matriz-de-roles.md). Each test describes the behaviour a person
// expects. The ones the app does not do yet are marked `test.fail` with the reason: the day the
// app is fixed the test turns "unexpectedly passing" and the mark is removed. Fixed since then
// (their tests stay as plain tests): the back button in the sign-up of a distributor, the
// storage notice over "Guardar cambios", the answer of /restablecer, the 404 page with a session
// and the password of spaces.
// The groups marked "second pass" come from the pass of 2026-10-12, over the history of the
// sign-up wizard, the live review of the platform and the live office.
import { expect, type Page } from '@playwright/test';
import { SEED_DISTRIBUTORS } from '../../seed/data';
import { type Actors, DESKTOP, type Device, PHONE, test } from '../support/actors';
import {
  createTestAccount,
  readDocument,
  uniqueTag,
  writeDocument,
} from '../support/emulator-admin';
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
/** How the screens write that phone, when they group its digits. */
const OTHER_PHONE_SHOWN = /900\s?000\s?096/;
const LISTING_CHANGED =
  'La ficha cambió mientras la revisabas. Revisa los datos nuevos antes de aprobar.';
const REVIEW_NOTE = 'El nombre no coincide con la razón social declarada.';

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
async function foundedOffice(actors: Actors, tag: string, device: Device = DESKTOP) {
  const account = await createTestAccount(tag);
  const name = `Gas Recorrido ${tag}`;
  const slug = `recorrido-${tag}`;
  const owner = await actors.open(device);
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
    // Nothing was approved: the screen says why and shows the new data (it follows the listing
    // live, so the name may have arrived even before the click).
    await expect(admin.page.getByText(LISTING_CHANGED)).toBeVisible();
    await expect(admin.page.getByText(changedName).first()).toBeVisible();
    await expect(admin.page.getByText(OTHER_PHONE_SHOWN).first()).toBeVisible();
    await expect(admin.page.getByText('Ficha aprobada.')).toHaveCount(0);

    const refused = await readDocument(`distributors/${id}/private/control`);
    const listing = await readDocument(`distributors/${id}`);
    expect(listing?.name).toBe(changedName);
    expect(refused?.listingApproved, 'approved a name the admin never saw').not.toBe(true);

    // Once the admin says it looked at the new data, the approval is for that data.
    await admin.page.getByRole('button', { name: 'Ya revisé los datos nuevos' }).click();
    await expect(admin.page.getByText(LISTING_CHANGED)).toHaveCount(0);
    await admin.page.getByRole('button', { name: 'Aprobar' }).click();
    await admin.page.getByRole('button', { name: 'Sí, aprobar' }).click();
    await expect(admin.page.getByText('Ficha aprobada.')).toBeVisible();

    const approved = await readDocument(`distributors/${id}/private/control`);
    expect(approved?.listingApproved).toBe(true);
    expect(approved?.distributorName).toBe(changedName);
    expect([...owner.errors, ...admin.errors]).toEqual([]);
  });

  // PLAN 2.11. MEDIO: the owner waits for the review looking at this panel.
  test('the office of the owner shows the approval without reloading the page', async ({
    actors,
  }, testInfo) => {
    const { id, owner } = await foundedOffice(actors, uniqueTag(testInfo));
    const admin = await actors.openSeed('admin');
    await admin.page.goto(`/plataforma/altas/${id}`);
    await admin.page.getByRole('button', { name: 'Aprobar' }).click();
    await admin.page.getByRole('button', { name: 'Sí, aprobar' }).click();
    await expect(admin.page.getByText('Ficha aprobada.')).toBeVisible();

    // The owner never left the office and never reloaded it.
    await expect(owner.page.getByRole('button', { name: 'Copiar enlace' })).toBeVisible();
    await expect(owner.page.getByText('Visible en el buscador', { exact: true })).toBeVisible();
    await expect(owner.page.getByText('En revisión', { exact: true })).toHaveCount(0);

    // The same for a note: it reaches the open office with its text.
    await admin.page.getByRole('button', { name: 'Pedir cambios' }).click();
    await admin.page.getByLabel('Nota para la distribuidora').fill(REVIEW_NOTE);
    await admin.page.getByRole('button', { name: 'Enviar nota' }).click();
    await expect(admin.page.getByText('Nota enviada.')).toBeVisible();

    await expect(owner.page.getByText('Cambios pedidos', { exact: true })).toBeVisible();
    await expect(owner.page.getByText(REVIEW_NOTE)).toBeVisible();
    await expect(owner.page.getByRole('button', { name: 'Copiar enlace' })).toHaveCount(0);

    // And for a suspension: the office turns read-only under its owner.
    await admin.page.getByRole('button', { name: 'Suspender' }).click();
    await admin.page.getByRole('button', { name: 'Sí, suspender' }).click();
    await expect(admin.page.getByText('Distribuidora suspendida.')).toBeVisible();

    await expect(owner.page.getByText('Hornilla suspendió tu distribuidora').first()).toBeVisible();
    expect([...owner.errors, ...admin.errors]).toEqual([]);
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

test.describe('second pass: the sign-up wizard and the history of the browser', () => {
  test.beforeEach(async ({ page }) => {
    await dismissStorageNotice(page);
  });

  // PLAN 2.2. MEDIO: the office is where a new owner waits for the review, and reloading it is
  // the first thing a person who waits does. After that, "back" shows the first step empty, as
  // if nothing had been registered; typing the same link again answers "ya lo usa otra
  // distribuidora". Without the reload the screen "<name> ya está creada" comes up, as it should.
  test('after founding and reloading the office, "back" does not offer an empty wizard', async ({
    page,
  }, testInfo) => {
    test.fail(
      true,
      'role-walker 2026-10-12: the memory of the finished sign-up does not survive a reload, so "back" lands on an empty first step',
    );
    const tag = uniqueTag(testInfo);
    const account = await createTestAccount(tag);
    await signInWithPassword(page, account.email, '/inicio');
    await foundDistributor(page, { name: `Gas Vuelta ${tag}`, slug: `vuelta-${tag}` });

    await page.reload();
    await expect(heading(page)).toHaveText(`Hoy en Gas Vuelta ${tag}.`);
    await page.goBack();

    await expect(page).toHaveURL(new RegExp(`${FOUNDING_PATH}$`));
    await expect(page.getByText(/ya está creada/)).toBeVisible({ timeout: 5_000 });
    await expect(page.getByLabel('Nombre de la distribuidora')).toHaveCount(0);
  });

  // PLAN 2.2. BAJO: a double click on "Continuar" (a habit on a desktop) moves one step, as it
  // should, but leaves two entries of the history for it: the first "back" seems to do nothing.
  test('after a double click on "Continuar", one "back" returns to the previous step', async ({
    page,
  }, testInfo) => {
    test.fail(
      true,
      'role-walker 2026-10-12: the double click pushes the next step twice; the first "back" stays on the same step',
    );
    const tag = uniqueTag(testInfo);
    const account = await createTestAccount(tag);
    await signInWithPassword(page, account.email, '/inicio');
    await page.goto(FOUNDING_PATH);
    await page.getByLabel('Nombre de la distribuidora').fill(`Gas Doble ${tag}`);
    await page.getByLabel('Enlace de tu página').fill(`doble-${tag}`);
    await expect(page.getByText('Está libre.')).toBeVisible();
    await page.getByLabel('Teléfono del negocio').fill(BUSINESS_PHONE);
    await page.getByLabel(FOUNDING_VERIFICATION.taxIdLabel).fill(FOUNDING_VERIFICATION.taxId);
    await page
      .getByLabel(FOUNDING_VERIFICATION.legalNameLabel)
      .fill(FOUNDING_VERIFICATION.legalName);
    await page.getByLabel(FOUNDING_VERIFICATION.registryLabel).fill(FOUNDING_VERIFICATION.registry);

    await page.getByRole('button', { name: 'Continuar' }).dblclick();
    await expect(heading(page)).toContainText('tu planta.');
    await page.goBack();

    await expect(page.getByLabel('Nombre de la distribuidora')).toHaveValue(`Gas Doble ${tag}`, {
      timeout: 5_000,
    });
  });
});

test.describe('second pass: the review and the office, live', () => {
  test.skip(({ isMobile }) => isMobile, 'Each actor opens its own device: runs once, on desktop');

  // PLAN 2.11. MEDIO: the question "¿Aprobar esta ficha?" is the pause before the only brake on
  // a false listing. On a desktop its button "Sí, aprobar" appears under the pointer, where
  // "Aprobar" was: the second click of a double click answers the question nobody read.
  // "Suspender" does not have this problem: its confirmation lands somewhere else.
  test('a double click on "Aprobar" does not approve before the question is read', async ({
    actors,
  }, testInfo) => {
    test.fail(
      true,
      'role-walker 2026-10-12: at 1440 px "Sí, aprobar" replaces "Aprobar" under the pointer and the double click approves',
    );
    const { id } = await foundedOffice(actors, uniqueTag(testInfo));
    const admin = await actors.openSeed('admin');
    await admin.page.goto(`/plataforma/altas/${id}`);
    await expect(admin.page.getByRole('button', { name: 'Aprobar' })).toBeVisible();

    await admin.page.getByRole('button', { name: 'Aprobar' }).dblclick();

    await expect(admin.page.getByRole('button', { name: 'Sí, aprobar' })).toBeVisible({
      timeout: 5_000,
    });
    const control = await readDocument(`distributors/${id}/private/control`);
    expect(control?.listingApproved, 'approved by a double click').not.toBe(true);
  });

  // PLAN 2.11 (M1 of the audit). MEDIO: changing the address of an approved listing takes it
  // out of the finder, and the question that says so, with its two buttons, opens below the
  // visible part of the screen: at 1440 px only its title shows, at 390 px it is under the
  // navigation bar. Pressing "Guardar cambios" seems to do nothing.
  for (const [label, device] of [
    ['phone', PHONE],
    ['desktop', DESKTOP],
  ] as const) {
    test(`the question before sending an approved listing back to review is on the screen (${label})`, async ({
      actors,
    }, testInfo) => {
      test.fail(
        true,
        'role-walker 2026-10-12: "Guardar y enviar a revisión" renders below the fold and nothing scrolls to it',
      );
      const { id, owner } = await foundedOffice(actors, uniqueTag(testInfo), device);
      const admin = await actors.openSeed('admin');
      await admin.page.goto(`/plataforma/altas/${id}`);
      await admin.page.getByRole('button', { name: 'Aprobar' }).click();
      await admin.page.getByRole('button', { name: 'Sí, aprobar' }).click();
      await expect(owner.page.getByText('Visible en el buscador', { exact: true })).toBeVisible();
      await owner.page.goto('/central/ficha');
      await owner.page.getByLabel('Dirección de la planta').fill('Av. Ensayo 703');

      await owner.page.getByRole('button', { name: 'Guardar cambios' }).click();

      const confirm = owner.page.getByRole('button', { name: 'Guardar y enviar a revisión' });
      await expect(confirm).toBeVisible();
      await expect(confirm).toBeInViewport({ ratio: 1, timeout: 5_000 });
    });
  }
});

test.describe('second pass: a suspended distributor', () => {
  test.beforeEach(async ({ page }) => {
    await dismissStorageNotice(page);
  });

  // PLAN 5.4 ("solo lectura"). MEDIO: the form says "está en solo lectura" on top and then lets
  // its owner change every field and press "Guardar cambios"; only after the question about the
  // review does it answer "No tienes permiso para hacer esto, o la distribuidora está en solo
  // lectura". Nothing is saved (the rules refuse), but the screen invited the work.
  test('the listing form of a suspended distributor does not offer to save', async ({ page }) => {
    test.fail(
      true,
      'role-walker 2026-10-12: every field and "Guardar cambios" stay enabled on a read-only distributor',
    );
    await signInAsSeedUser(page, 'ownerC');
    await page.goto('/central/ficha');
    await expect(page.getByLabel('Nombre de la distribuidora')).toHaveValue(
      SEED_DISTRIBUTORS.c.name,
    );

    await expect(page.getByRole('button', { name: 'Guardar cambios' })).not.toBeEnabled({
      timeout: 5_000,
    });
  });

  // PLAN 5.4. BAJO today (the driver has nothing to do until phase 5), but the panel is the
  // only place where a driver would learn why nothing arrives: the office says "Suspendida" to
  // the owner and to the dispatcher, and the driver's screen says nothing, with or without a
  // reload.
  test('the panel of a driver says that the distributor is suspended', async ({
    page,
  }, testInfo) => {
    test.fail(
      true,
      'role-walker 2026-10-12: /reparto of a suspended distributor shows "Sin jornada abierta" and no word about the suspension',
    );
    const account = await createTestAccount(uniqueTag(testInfo));
    const now = new Date();
    await writeDocument(`distributors/${SEED_DISTRIBUTORS.c.id}/members/${account.uid}`, {
      uid: account.uid,
      distributorId: SEED_DISTRIBUTORS.c.id,
      role: 'driver',
      active: true,
      displayName: account.displayName,
      distributorName: SEED_DISTRIBUTORS.c.name,
      createdAt: now,
      updatedAt: now,
    });

    await signInWithPassword(page, account.email, '/reparto');

    await expect(heading(page)).toBeVisible();
    // Not the name of the seeded distributor ("Gas Demo Suspendida"): a sentence about its state.
    await expect(
      page
        .getByRole('main')
        .getByText(/suspendió|solo lectura/i)
        .first(),
    ).toBeVisible({ timeout: 5_000 });
  });
});
