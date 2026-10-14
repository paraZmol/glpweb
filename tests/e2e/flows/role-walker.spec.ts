// role-walker
// What a person found in the first minutes of using the built app, role by role, on the pass
// of 2026-10-11 (docs/testing/matriz-de-roles.md). Each test describes the behaviour a person
// expects. The ones the app does not do yet are marked `test.fail` with the reason: the day the
// app is fixed the test turns "unexpectedly passing" and the mark is removed. Fixed since then
// (their tests stay as plain tests): the back button in the sign-up of a distributor, the
// storage notice over "Guardar cambios" and the 404 page with a session. Two findings of that
// pass were about the password (the answer of /restablecer, a password of spaces): their tests
// left with the screens when sign-in became Google only (PLAN 2.1, 2026-10-12).
// The groups marked "second pass" come from the pass of 2026-10-12, over the history of the
// sign-up wizard, the live review of the platform and the live office. Fixed since (plain tests
// now): the double click on "Aprobar" and on "Continuar", the question before sending a listing
// back to review, the read-only listing form, the driver's panel of a suspended distributor,
// the notices of the platform, the welcome of the office and the long lists of the platform.
// Still open, both waiting for a decision on storage (docs/legal/cookies.md): a reload in the
// middle of the wizard, and "back" after founding and reloading the office.
// The group "third pass" comes from the pass of 2026-10-14 over the sign-in with Google only:
// the answer when the window of Google is closed, a second tab on the terms, a long name and
// the main heading of the screen of an unconfirmed e-mail.
import { expect, type Page } from '@playwright/test';
import { SEED_DISTRIBUTORS } from '../../seed/data';
import { type Actors, DESKTOP, type Device, PHONE, test } from '../support/actors';
import {
  createTestAccount,
  deleteDocument,
  readDocument,
  uniqueTag,
  writeDocument,
} from '../support/emulator-admin';
import { foundDistributor, FOUNDING_PATH, FOUNDING_VERIFICATION } from '../support/founding';
import { signInAs, signInAsSeedUser } from '../support/sign-in';
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
const STANDING_CHANGED = 'Otra persona de Hornilla cambió el estado de esta ficha.';
const REVIEW_NOTE = 'El nombre no coincide con la razón social declarada.';
const WELCOME = /ya está en Hornilla\. Empezaron tus 30 días de prueba gratis/;
const LEFT_UNSAVED = /pasó a solo lectura mientras editabas\. Lo que escribiste sigue a la vista/;

/** The rows of the list of the platform panel that is on screen. */
const listRows = (page: Page) =>
  page.getByRole('main').getByRole('listitem').filter({ hasText: 'Identificador' });

/** Where the usable part of the screen ends: the top of the bottom bar, or the viewport. */
async function clearBottomOf(page: Page): Promise<number> {
  const bar = await page.getByRole('navigation', { name: 'Principal' }).boundingBox();
  const viewport = page.viewportSize()?.height ?? 0;
  return bar && bar.y > viewport / 2 ? bar.y : viewport;
}

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
  await signInAs(owner.page, account, '/inicio');
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
    await signInAs(page, account, '/inicio');
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
    await signInAs(page, account, '/inicio');
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
    // B5: the welcome says "aparecerá en el buscador cuando Hornilla revise sus datos".
    await expect(owner.page.getByText(WELCOME)).toBeVisible();
    await admin.page.goto(`/plataforma/altas/${id}`);
    await admin.page.getByRole('button', { name: 'Aprobar' }).click();
    await admin.page.getByRole('button', { name: 'Sí, aprobar' }).click();
    await expect(admin.page.getByText('Ficha aprobada.')).toBeVisible();

    // The owner never left the office and never reloaded it.
    await expect(owner.page.getByRole('button', { name: 'Copiar enlace' })).toBeVisible();
    await expect(owner.page.getByText('Visible en el buscador', { exact: true })).toBeVisible();
    // ...and the welcome does not stand next to the state it announced as still to come.
    await expect(owner.page.getByText(WELCOME)).toHaveCount(0);
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
    await owner.page.reload();
    await expect(owner.page.getByText('Hornilla suspendió tu distribuidora').first()).toBeVisible();
    await expect(owner.page.getByText(WELCOME)).toHaveCount(0);
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
      await signInAs(page, account, '/central');
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

  // PLAN 2.4. BAJO.
  test('the "not found" page does not offer "Ingresar" to somebody already signed in', async ({
    page,
  }) => {
    await signInAsSeedUser(page, 'customer');

    await page.goto('/una-pagina-que-no-existe');

    await expect(heading(page)).toContainText('no existe');
    await expect(page.getByRole('main').getByRole('link', { name: 'Ingresar' })).toHaveCount(0);
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
    await signInAs(page, account, '/inicio');
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
    const tag = uniqueTag(testInfo);
    const account = await createTestAccount(tag);
    await signInAs(page, account, '/inicio');
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
  // Fixed: the answers of every question sit at the other edge and ignore the pointer for an
  // instant after they appear (`ConfirmPanel`).
  test('a double click on "Aprobar" does not approve before the question is read', async ({
    actors,
  }, testInfo) => {
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
    // The question is still answerable once it has been on screen for a moment.
    await admin.page.getByRole('button', { name: 'Sí, aprobar' }).click();
    await expect(admin.page.getByText('Ficha aprobada.')).toBeVisible();
  });

  // The same for every decision that cannot be taken back with one more click.
  for (const [open, confirm, done] of [
    ['Suspender', 'Sí, suspender', 'Distribuidora suspendida.'],
    ['Reactivar', 'Sí, reactivar', 'Distribuidora reactivada.'],
  ] as const) {
    test(`a double click on "${open}" does not answer its question`, async ({ actors }) => {
      const admin = await actors.openSeed('admin');
      // Seeded: A operates, C is suspended. Nothing is decided here, so they stay as they are.
      const seeded = open === 'Suspender' ? SEED_DISTRIBUTORS.a : SEED_DISTRIBUTORS.c;
      await admin.page.goto(`/plataforma/altas/${seeded.id}`);
      await expect(admin.page.getByRole('button', { name: open })).toBeVisible();

      await admin.page.getByRole('button', { name: open }).dblclick();

      await expect(admin.page.getByRole('button', { name: confirm })).toBeVisible();
      await expect(admin.page.getByText(done)).toHaveCount(0);
      const control = await readDocument(`distributors/${seeded.id}/private/control`);
      expect(control?.status).toBe(seeded.status);
    });
  }

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
      // Whole on the screen means its title too, and nothing of it under the bottom bar.
      const question = owner.page.getByRole('group', { name: '¿Guardar y volver a revisión?' });
      await expect(question).toBeInViewport({ ratio: 1 });
      await expect(question).toBeFocused();
      const box = await question.boundingBox();
      expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(
        await clearBottomOf(owner.page),
      );
      // And it still answers: the listing goes back to review.
      await confirm.click();
      await expect(owner.page).toHaveURL(/\/central$/);
      await expect(owner.page.getByText('En revisión', { exact: true })).toBeVisible();
    });
  }

  // B4. Suspending stamps the public profile without changing a word of it: the admin who had
  // the listing open read "La ficha cambió mientras la revisabas" over data that was the same.
  test('a suspension by another admin is not announced as a change of the listing', async ({
    actors,
  }, testInfo) => {
    const { id } = await foundedOffice(actors, uniqueTag(testInfo));
    const reviewer = await actors.openSeed('admin');
    const other = await actors.openSeed('admin');
    await reviewer.page.goto(`/plataforma/altas/${id}`);
    await expect(reviewer.page.getByRole('button', { name: 'Aprobar' })).toBeVisible();

    await other.page.goto(`/plataforma/altas/${id}`);
    await other.page.getByRole('button', { name: 'Suspender' }).click();
    await other.page.getByRole('button', { name: 'Sí, suspender' }).click();
    await expect(other.page.getByText('Distribuidora suspendida.')).toBeVisible();

    await expect(reviewer.page.getByText(STANDING_CHANGED)).toBeVisible();
    await expect(reviewer.page.getByText(LISTING_CHANGED)).toHaveCount(0);
    await expect(reviewer.page.getByRole('button', { name: 'Reactivar' })).toBeVisible();
    // Whoever decided does not read that somebody else did.
    await expect(other.page.getByText(STANDING_CHANGED)).toHaveCount(0);
    // The data is the one that was looked at: the approval goes through without a second look.
    await reviewer.page.getByRole('button', { name: 'Aprobar' }).click();
    await reviewer.page.getByRole('button', { name: 'Sí, aprobar' }).click();
    await expect(reviewer.page.getByText('Ficha aprobada.')).toBeVisible();
    expect([...reviewer.errors, ...other.errors]).toEqual([]);
  });

  // B4. On a phone the open distributor is a screen of its own: it kept the title of the list
  // ("Altas pendientes.") over a listing that had just been approved.
  test('on a phone an approved listing is not left under the title of the pending ones', async ({
    actors,
  }, testInfo) => {
    const { id, name } = await foundedOffice(actors, uniqueTag(testInfo));
    const admin = await actors.open(PHONE);
    await signInAsSeedUser(admin.page, 'admin');
    await admin.page.goto(`/plataforma/altas/${id}`);
    await expect(heading(admin.page)).toHaveText('Revisar una distribuidora.');
    await expect(admin.page.getByRole('heading', { name, exact: true })).toBeVisible();

    await admin.page.getByRole('button', { name: 'Aprobar' }).click();
    await admin.page.getByRole('button', { name: 'Sí, aprobar' }).click();
    await expect(admin.page.getByText('Ficha aprobada.')).toBeVisible();

    await expect(heading(admin.page)).toHaveText('Revisar una distribuidora.');
    await expect(admin.page.getByText('Altas pendientes.')).toHaveCount(0);
    await expect(admin.page.getByText(/Ya no está en la lista «En revisión»/)).toBeVisible();
    await expect(admin.page.getByText('Aprobada y visible', { exact: true })).toBeVisible();
    expect(admin.errors).toEqual([]);
  });

  // M3, live: the suspension arrives while its owner is typing in the form.
  test('a suspension that arrives in the middle of an edit keeps what was typed, as read-only', async ({
    actors,
  }, testInfo) => {
    const { id, owner } = await foundedOffice(actors, uniqueTag(testInfo), PHONE);
    const admin = await actors.openSeed('admin');
    await owner.page.goto('/central/ficha');
    const address = owner.page.getByLabel('Dirección de la planta');
    await address.fill('Av. Ensayo 705');
    await expect(owner.page.getByRole('button', { name: 'Guardar cambios' })).toBeEnabled();

    await admin.page.goto(`/plataforma/altas/${id}`);
    await admin.page.getByRole('button', { name: 'Suspender' }).click();
    await admin.page.getByRole('button', { name: 'Sí, suspender' }).click();
    await expect(admin.page.getByText('Distribuidora suspendida.')).toBeVisible();

    await expect(owner.page.getByRole('button', { name: 'Guardar cambios' })).toHaveCount(0);
    await expect(address).toBeDisabled();
    await expect(address).toHaveValue('Av. Ensayo 705');
    await expect(owner.page.getByText(LEFT_UNSAVED)).toBeVisible();
    await expect(owner.page.getByText('Hornilla suspendió tu distribuidora').first()).toBeVisible();
    const stored = await readDocument(`distributors/${id}`);
    expect(stored?.addressLine).not.toBe('Av. Ensayo 705');
    expect([...owner.errors, ...admin.errors]).toEqual([]);
  });
});

test.describe('second pass: a suspended distributor', () => {
  test.beforeEach(async ({ page }) => {
    await dismissStorageNotice(page);
  });

  // PLAN 5.4 ("solo lectura"). MEDIO: the form says "está en solo lectura" on top and then lets
  // its owner change every field and press "Guardar cambios"; only after the question about the
  // review does it answer "No tienes permiso para hacer esto, o la distribuidora está en solo
  // lectura". Nothing is saved (the rules refuse), but the screen invited the work.
  // Fixed: read-only shows the listing as data, with no button to save at all. The same for a
  // trial that ran out (D), which is read-only for another reason.
  for (const [key, distributor, why] of [
    ['ownerC', SEED_DISTRIBUTORS.c, /Hornilla suspendió tu distribuidora/],
    ['ownerD', SEED_DISTRIBUTORS.d, /está en solo lectura: no se pueden guardar cambios/],
  ] as const) {
    test(`the listing form of a read-only distributor does not offer to save (${key})`, async ({
      page,
    }) => {
      await signInAsSeedUser(page, key);
      await page.goto('/central/ficha');
      await expect(page.getByLabel('Nombre de la distribuidora')).toHaveValue(distributor.name);

      await expect(heading(page)).toHaveText('Tu ficha.');
      await expect(page.getByText(why).first()).toBeVisible();
      await expect(page.getByRole('button', { name: 'Guardar cambios' })).toHaveCount(0);
      for (const label of [
        'Nombre de la distribuidora',
        'Teléfono del negocio',
        'WhatsApp del negocio',
        'Dirección de la planta',
        'Abre a las',
        'O escribe tu color',
      ]) {
        await expect(page.getByLabel(label, { exact: true })).toBeDisabled();
      }
      await expect(page.getByRole('button', { name: 'Lunes' })).toBeDisabled();
      await expect(
        page.getByRole('button', { name: 'Ampliar el radio un kilómetro' }),
      ).toBeDisabled();
    });
  }

  // PLAN 5.4. BAJO today (the driver has nothing to do until phase 5), but the panel is the
  // only place where a driver would learn why nothing arrives: the office says "Suspendida" to
  // the owner and to the dispatcher, and the driver's screen says nothing, with or without a
  // reload.
  test('the panel of a driver says that the distributor is suspended', async ({
    page,
  }, testInfo) => {
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

    await signInAs(page, account, '/reparto');

    await expect(heading(page)).toBeVisible();
    // Not the name of the seeded distributor ("Gas Demo Suspendida"): a sentence about its state.
    await expect(
      page
        .getByRole('main')
        .getByText(/suspendió|solo lectura/i)
        .first(),
    ).toBeVisible({ timeout: 5_000 });
    // In words a driver can act on, and again after a reload.
    await expect(page.getByText(/No depende de ti: avísale a quien es titular/)).toBeVisible();
    await page.reload();
    await expect(page.getByText(/Hornilla suspendió Gas Demo Suspendida/)).toBeVisible();
  });
});

test.describe('second pass: the welcome of the office and the long lists of the platform', () => {
  test.beforeEach(async ({ page }) => {
    await dismissStorageNotice(page);
  });

  // B5. The green strip stayed for the whole session, also next to "Suspendida".
  test('the welcome after founding can be closed and does not come back with a reload', async ({
    page,
  }, testInfo) => {
    const tag = uniqueTag(testInfo);
    const account = await createTestAccount(tag);
    await signInAs(page, account, '/inicio');
    await foundDistributor(page, { name: `Gas Saludo ${tag}`, slug: `saludo-${tag}` });
    await expect(page.getByText(WELCOME)).toBeVisible();

    await page.getByRole('button', { name: 'Entendido' }).click();

    await expect(page.getByText(WELCOME)).toHaveCount(0);
    await expect(page.getByText('En revisión', { exact: true })).toBeVisible();
    await page.reload();
    await expect(heading(page)).toHaveText(`Hoy en Gas Saludo ${tag}.`);
    await expect(page.getByText(WELCOME)).toHaveCount(0);
  });

  // B3. PLAN 2.11: the lists are paged by 20. Opening a distributor after "Cargar más" threw
  // the list back to its first 20 rows, at the top.
  test.describe('a list of the platform with more than one page', () => {
    const EXTRA = 22;
    // Dated far ahead: last in every list (oldest first), so no other test meets them early.
    const FOUNDED = new Date('2099-01-01T15:00:00Z');
    let paths: string[] = [];

    test.beforeEach(async ({ page }, testInfo) => {
      const tag = uniqueTag(testInfo);
      paths = Array.from(
        { length: EXTRA },
        (_unused, index) => `distributors/e2e-lista-${tag}-${index}/private/control`,
      );
      await Promise.all(
        paths.map((path, index) =>
          writeDocument(path, {
            ownerUid: 'e2e-nadie',
            status: 'suspended',
            trialEndsAt: FOUNDED,
            listingApproved: true,
            distributorName: `Gas Lista ${tag} ${index}`,
            slug: `lista-${tag}-${index}`,
            createdAt: new Date(FOUNDED.getTime() + index),
            updatedAt: FOUNDED,
          }),
        ),
      );
      await signInAsSeedUser(page, 'admin');
      await page.goto('/plataforma?estado=suspendidas');
      await expect(listRows(page)).toHaveCount(20);
      await page.getByRole('button', { name: 'Cargar más' }).click();
      await expect(listRows(page)).not.toHaveCount(20);
    });

    test.afterEach(async () => {
      await Promise.all(paths.map(deleteDocument));
    });

    test('desktop: the list beside the open distributor keeps every row loaded', async ({
      page,
      isMobile,
    }) => {
      test.skip(isMobile, 'The list stays beside the distributor only on a desktop');
      const rows = listRows(page);
      const loaded = await rows.count();
      await rows.last().scrollIntoViewIfNeeded();

      await rows.last().getByRole('link').click();

      await expect(page).toHaveURL(/\/plataforma\/altas\/.+estado=suspendidas$/);
      await expect(rows.last().getByRole('link')).toHaveAttribute('aria-current', 'page');
      await expect(rows).toHaveCount(loaded);
      expect(loaded).toBeGreaterThan(20);
      await expect(rows.last()).toBeInViewport();
    });

    test('phone: back from the distributor, the list is as long and as far down as it was left', async ({
      page,
      isMobile,
    }) => {
      test.skip(!isMobile, 'The distributor takes the whole screen only on a phone');
      const rows = listRows(page);
      const loaded = await rows.count();
      await rows.last().scrollIntoViewIfNeeded();
      const scrolledTo = await page.evaluate(() => window.scrollY);

      await rows.last().getByRole('link').click();
      await expect(heading(page)).toHaveText('Revisar una distribuidora.');
      await page.getByRole('button', { name: 'Volver a la lista' }).click();

      await expect(heading(page)).toHaveText('Distribuidoras suspendidas.');
      await expect(rows).toHaveCount(loaded);
      expect(loaded).toBeGreaterThan(20);
      expect(scrolledTo).toBeGreaterThan(0);
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(scrolledTo);
    });
  });
});

// Third pass (2026-10-14): the sign-in is with Google only (PLAN 2.1, §11 2026-10-12 and
// 2026-10-14). The first entry presses the real button and goes through the window of the Auth
// emulator; the rest open the session the way the other flows do.
test.describe('third pass: signing in with Google', () => {
  /** What the window of the Auth emulator asks other sites for: its looks, nothing it needs. */
  const WINDOW_DRESSING = /^https:\/\/(unpkg\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)\//;
  const CANCELLED = 'Se canceló el ingreso.';

  async function openGoogleWindow(page: Page): Promise<Page> {
    await page.context().route(WINDOW_DRESSING, (route) => route.abort());
    const opening = page.waitForEvent('popup');
    await page.getByRole('button', { name: 'Continuar con Google' }).click();
    const popup = await opening;
    await popup.locator('#add-account-button').waitFor();
    return popup;
  }

  test.beforeEach(async ({ page }) => {
    await dismissStorageNotice(page);
  });

  // MEDIO. A person closes the window of Google and the button keeps turning for about ten
  // seconds before the screen says anything: it looks stuck, and there is nothing to press.
  test('closing the window of Google is answered within a few seconds', async ({ page }) => {
    test.fail(
      true,
      'Known (role-walker, 2026-10-14): "Se canceló el ingreso." appears about 10 s after the window closes',
    );
    await page.goto('/ingresar');
    const popup = await openGoogleWindow(page);

    await popup.close();

    await expect(page.getByText(CANCELLED)).toBeVisible({ timeout: 3_000 });
    await expect(page.getByRole('button', { name: 'Continuar con Google' })).toBeEnabled({
      timeout: 1_000,
    });
  });

  // BAJO. After a cancelled attempt, pressing the button again opens the window while the red
  // "Se canceló el ingreso." of the previous attempt is still on the screen.
  test('a new attempt does not keep the message of the cancelled one', async ({ page }) => {
    test.fail(
      true,
      'Known (role-walker, 2026-10-14): the cancel message stays visible during the next attempt',
    );
    await page.goto('/ingresar');
    const first = await openGoogleWindow(page);
    await first.close();
    await expect(page.getByText(CANCELLED)).toBeVisible();

    await openGoogleWindow(page);

    await expect(page.getByText(CANCELLED)).toHaveCount(0);
  });

  // BAJO. Two tabs on "Un paso antes de empezar": accepting in one leaves the other asking for
  // the same acceptance, and its "No quiero continuar: eliminar mi cuenta" now answers that the
  // account already has data.
  test('a second tab on the terms follows when the first one accepts', async ({
    actors,
  }, testInfo) => {
    test.fail(
      true,
      'Known (role-walker, 2026-10-14): the other tab stays on /aceptar-terminos after the profile exists',
    );
    const { context, page: first } = await actors.open(DESKTOP);
    const email = `rw-dos-pestanas-${uniqueTag(testInfo)}@example.com`;
    await signInAs(first, { email, displayName: 'Z. Dos Pestañas' }, '/aceptar-terminos');
    const second = await context.newPage();
    await second.goto('/aceptar-terminos');
    await expect(heading(second)).toHaveText('Un paso antes de empezar.');

    await first.getByRole('checkbox', { name: /Acepto los Términos y condiciones/ }).check();
    await first.getByRole('checkbox', { name: /Leí la Política de privacidad/ }).check();
    await first.getByRole('button', { name: 'Aceptar y continuar' }).click();
    await expect(first).toHaveURL(/\/inicio$/);

    await expect(second).not.toHaveURL(/\/aceptar-terminos$/, { timeout: 10_000 });
  });

  // BAJO. The name Google hands over is shown as is: a long name without spaces (allowed up to
  // 80 characters) runs off the greeting of the home of a customer, cut at the edge.
  test('a long name does not run off the greeting of the home', async ({ page }, testInfo) => {
    test.fail(
      true,
      'Known (role-walker, 2026-10-14): a long name without spaces is cut at the edge of the greeting',
    );
    const email = `rw-nombre-largo-${uniqueTag(testInfo)}@example.com`;
    await signInAs(page, { email, displayName: 'x'.repeat(80) }, '/aceptar-terminos');
    await page.getByRole('checkbox', { name: /Acepto los Términos y condiciones/ }).check();
    await page.getByRole('checkbox', { name: /Leí la Política de privacidad/ }).check();
    await page.getByRole('button', { name: 'Aceptar y continuar' }).click();
    await expect(page).toHaveURL(/\/inicio$/);

    const greeting = heading(page);
    await expect(greeting).toContainText('Hola');
    const overflows = await greeting.evaluate((element) => {
      const box = element.getBoundingClientRect();
      return [...element.querySelectorAll('*'), element].some(
        (node) => node.getBoundingClientRect().right > Math.min(box.right, window.innerWidth) + 1,
      );
    });
    expect(overflows).toBe(false);
  });

  // BAJO (accessibility). The screen of a session whose e-mail is not confirmed shows its title
  // in large type, but a screen reader finds no main heading on the page.
  test('the screen of an unconfirmed e-mail has a main heading', async ({ page }) => {
    test.fail(
      true,
      'Known (role-walker, 2026-10-14): "No pudimos confirmar tu correo con Google." is not a level-1 heading',
    );
    await signInAsSeedUser(page, 'unverified');

    await expect(
      page.getByText('No pudimos confirmar tu correo con Google.').first(),
    ).toBeVisible();
    await expect(heading(page)).toHaveText('No pudimos confirmar tu correo con Google.');
  });
});
