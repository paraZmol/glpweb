import { expect, type Page } from '@playwright/test';
import {
  type Actor,
  type Actors,
  DESKTOP,
  PHONE,
  runOncePerActorDevices,
  type SeedActor,
  test,
} from '../support/actors';
import { createTestAccount, readDocument, uniqueTag } from '../support/emulator-admin';
import { foundDistributor, FOUNDING_PLANT, FOUNDING_VERIFICATION } from '../support/founding';
import { signInWithPassword } from '../support/sign-in';

test.skip(
  process.env.E2E_EMULATORS !== 'true',
  'Needs the seeded emulators: run with E2E_EMULATORS=true',
);
runOncePerActorDevices();
// Three people, each loading the app cold, and a whole sign-up before the flow starts.
test.slow();

const NOT_FOUND = 'Esta distribuidora no existe.';
const IN_REVIEW_TEXT =
  'Estamos revisando tus datos. Mientras tanto puedes preparar tu catálogo; tus clientes todavía no te ven.';
const BACK_TO_REVIEW =
  'Cambiar el nombre, el teléfono o el WhatsApp devuelve tu ficha a revisión: dejará de verse en el buscador y en tu enlace hasta que Hornilla la apruebe de nuevo.';
const NOTE = 'El número de ficha no coincide con la razón social. Revísalo.';
/** Follows the fake pattern 9000000xx of the seed. */
const NEW_PHONE = '900000096';
const CORRECTED_LEGAL_NAME = 'Gas Ensayo Corregido S.A.C.';

const heading = (page: Page) => page.getByRole('heading', { level: 1 });
const chip = (page: Page, text: string) => page.getByText(text, { exact: true });

interface Listing {
  id: string;
  name: string;
  slug: string;
  owner: Actor;
  admin: SeedActor;
  visitor: Actor;
}

/**
 * A distributor founded through the screen by an account of its own, its owner standing on the
 * office; the platform admin on its panel; and a visitor without a session, on a phone standing
 * at the door of the plant.
 */
async function foundedListing(actors: Actors, tag: string): Promise<Listing> {
  const account = await createTestAccount(tag);
  const name = `Gas Revisión ${tag}`;
  const slug = `revision-${tag}`;
  const owner = await actors.open(DESKTOP);
  await signInWithPassword(owner.page, account.email, '/inicio');
  await foundDistributor(owner.page, { name, slug });
  const link = await readDocument(`slugs/${slug}`);
  const admin = await actors.openSeed('admin');
  const visitor = await actors.open(PHONE);
  // Every visit of the visitor starts without a remembered point: the search is asked for anew.
  await visitor.context.addInitScript(() =>
    window.localStorage.removeItem('hornilla.lastLocation'),
  );
  await visitor.context.grantPermissions(['geolocation']);
  await visitor.context.setGeolocation({
    latitude: Number(FOUNDING_PLANT.latitude),
    longitude: Number(FOUNDING_PLANT.longitude),
  });
  return { id: String(link?.distributorId), name, slug, owner, admin, visitor };
}

/** One decision of the platform panel, confirmed; `toast` is what the panel says when done. */
async function decide(page: Page, action: string, confirm: string, toast: string) {
  await page.getByRole('button', { name: action, exact: true }).click();
  await page.getByRole('button', { name: confirm, exact: true }).click();
  await expect(page.getByText(toast)).toBeVisible();
}

const approve = (page: Page) => decide(page, 'Aprobar', 'Sí, aprobar', 'Ficha aprobada.');

/** Whether the search from the door of the plant lists it, once the search has settled. */
async function expectInFinder(visitor: Page, name: string, isListed: boolean) {
  await visitor.goto('/');
  await visitor.getByRole('button', { name: 'Usar mi ubicación' }).click();
  await expect(
    visitor.getByRole('heading', { name: /Llegan a tu punto|Nadie llega todavía/ }),
  ).toBeVisible();
  await expect(visitor.getByRole('link', { name: `Ver distribuidora ${name}` })).toHaveCount(
    isListed ? 1 : 0,
  );
}

async function expectPage(visitor: Page, { slug, name }: Listing, isPublic: boolean) {
  await visitor.goto(`/d/${slug}`);
  await expect(heading(visitor)).toHaveText(isPublic ? name : NOT_FOUND);
  if (!isPublic) expect(await visitor.locator('body').innerText()).not.toContain(name);
}

// PLAN 2.11: a new distributor waits for the review of the platform; nobody but its staff sees
// it until a platform admin approves it from /plataforma.
test('a new distributor is in review and hidden; the admin approves it and visitors find it', async ({
  actors,
}, testInfo) => {
  const listing = await foundedListing(actors, uniqueTag(testInfo));
  const { owner, admin, visitor, id, name } = listing;

  // The owner is told where it stands, and sees its own page as a preview.
  await expect(chip(owner.page, 'En revisión')).toBeVisible();
  await expect(owner.page.getByText(IN_REVIEW_TEXT)).toBeVisible();
  // Visitors learn nothing: not on its link, not in the search.
  await expectPage(visitor.page, listing, false);
  await expectInFinder(visitor.page, name, false);

  // The admin finds it among the pending ones and opens it.
  await admin.page.goto('/plataforma');
  await expect(heading(admin.page)).toHaveText('Altas pendientes.');
  await admin.page.getByRole('link', { name: new RegExp(id) }).click();
  await expect(admin.page).toHaveURL(new RegExp(`/plataforma/altas/${id}$`));
  await expect(admin.page.getByRole('heading', { name, exact: true })).toBeVisible();
  await expect(chip(admin.page, 'Sin revisar').last()).toBeVisible();
  // What the founder declared, and where it is compared.
  await expect(admin.page.getByText(FOUNDING_VERIFICATION.taxId)).toBeVisible();
  await expect(admin.page.getByText(FOUNDING_VERIFICATION.legalName)).toBeVisible();
  await expect(admin.page.getByText(FOUNDING_VERIFICATION.registry)).toBeVisible();
  await expect(admin.page.getByRole('link', { name: /Consulta de RUC en SUNAT/ })).toHaveAttribute(
    'href',
    'https://www.sunat.gob.pe',
  );
  await expect(
    admin.page.getByRole('link', { name: /Registro de Hidrocarburos en Osinergmin/ }),
  ).toHaveAttribute('rel', 'noopener noreferrer');
  // Backing out of the confirmation changes nothing.
  await admin.page.getByRole('button', { name: 'Aprobar', exact: true }).click();
  await admin.page.getByRole('button', { name: 'Cancelar' }).click();
  expect(await readDocument(`distributors/${id}/private/control`)).toMatchObject({
    listingApproved: false,
  });

  await approve(admin.page);

  await expect(chip(admin.page, 'Aprobada y visible')).toBeVisible();
  // Approved: it is no longer among the pending ones.
  await expect(admin.page.getByRole('link', { name: new RegExp(id) })).toHaveCount(0);
  expect(await readDocument(`distributors/${id}/private/control`)).toMatchObject({
    listingApproved: true,
    approvedBy: admin.user.uid,
  });
  expect(await readDocument(`distributors/${id}`)).toMatchObject({ acceptingOrders: true });
  // Now anybody opens its page and finds it from the door of the plant.
  await expectPage(visitor.page, listing, true);
  await expect(visitor.page.getByText('Solo tú ves esta página')).toHaveCount(0);
  await expectInFinder(visitor.page, name, true);
  // And its owner is told, with the link to share.
  await owner.page.reload();
  await expect(chip(owner.page, 'Visible en el buscador')).toBeVisible();
  await expect(owner.page.getByRole('button', { name: 'Copiar enlace' })).toBeVisible();
  expect([...owner.errors, ...admin.errors, ...visitor.errors]).toEqual([]);
});

// PLAN 2.11: an approved listing cannot turn into another business overnight.
test('the owner changes the phone: warned before saving, back in review and hidden again', async ({
  actors,
}, testInfo) => {
  const listing = await foundedListing(actors, uniqueTag(testInfo));
  const { owner, admin, visitor, id } = listing;
  await admin.page.goto(`/plataforma/altas/${id}`);
  await approve(admin.page);
  await owner.page.reload();
  await expect(chip(owner.page, 'Visible en el buscador')).toBeVisible();
  await expectPage(visitor.page, listing, true);

  // An edit that does not touch who it is saves at once and changes nothing for visitors.
  await owner.page.getByRole('link', { name: 'Editar ficha' }).click();
  await expect(heading(owner.page)).toHaveText('Edita tu ficha.');
  await owner.page.getByLabel('Dirección de la planta').fill('Av. Ensayo 701');
  await expect(owner.page.getByText(BACK_TO_REVIEW)).toHaveCount(0);
  await owner.page.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(owner.page).toHaveURL(/\/central$/);
  await expect(chip(owner.page, 'Visible en el buscador')).toBeVisible();
  expect(await readDocument(`distributors/${id}`)).toMatchObject({
    addressLine: 'Av. Ensayo 701',
    acceptingOrders: true,
  });

  // The phone is who it is: the warning shows while typing, and saving asks once more.
  await owner.page.getByRole('link', { name: 'Editar ficha' }).click();
  await owner.page.getByLabel('Teléfono del negocio').fill(NEW_PHONE);
  await expect(owner.page.getByText(BACK_TO_REVIEW)).toBeVisible();
  await owner.page.getByRole('button', { name: 'Guardar cambios' }).click();
  const confirmation = owner.page.getByRole('group', { name: '¿Guardar y volver a revisión?' });
  await expect(confirmation).toBeVisible();
  // Nothing was sent yet.
  expect(await readDocument(`distributors/${id}`)).toMatchObject({ acceptingOrders: true });
  await confirmation.getByRole('button', { name: 'Guardar y enviar a revisión' }).click();

  await expect(owner.page).toHaveURL(/\/central$/);
  await expect(chip(owner.page, 'En revisión')).toBeVisible();
  expect(await readDocument(`distributors/${id}`)).toMatchObject({
    contactPhone: NEW_PHONE,
    acceptingOrders: false,
  });
  expect(await readDocument(`distributors/${id}/private/control`)).toMatchObject({
    listingApproved: false,
  });
  // Visitors lose it, on its link and in the search, until the platform looks again.
  await expectPage(visitor.page, listing, false);
  await expectInFinder(visitor.page, listing.name, false);
  // And it is back among the pending ones of the platform.
  await admin.page.goto('/plataforma');
  await expect(admin.page.getByRole('link', { name: new RegExp(id) })).toBeVisible();
  expect([...owner.errors, ...admin.errors, ...visitor.errors]).toEqual([]);
});

// PLAN 2.11: sending a listing back with a note, the correction by its founder, and suspending.
test('the admin asks for changes with a note, the founder corrects the data, and a suspension hides the page', async ({
  actors,
}, testInfo) => {
  const listing = await foundedListing(actors, uniqueTag(testInfo));
  const { owner, admin, visitor, id } = listing;
  await admin.page.goto(`/plataforma/altas/${id}`);

  // The note is not optional: the owner must be told what to correct.
  await admin.page.getByRole('button', { name: 'Pedir cambios', exact: true }).click();
  await admin.page.getByRole('button', { name: 'Enviar nota' }).click();
  await expect(
    admin.page.getByText('Escribe qué debe corregir: es lo que su titular va a leer en su panel.'),
  ).toBeVisible();
  await admin.page.getByLabel('Nota para su titular').fill(NOTE);
  await admin.page.getByRole('button', { name: 'Enviar nota' }).click();
  await expect(admin.page.getByText('Nota enviada. La ficha queda sin mostrar.')).toBeVisible();
  await expect(chip(admin.page, 'Con cambios pedidos').last()).toBeVisible();

  // The owner reads the note in its office and corrects what it declared.
  await owner.page.reload();
  await expect(chip(owner.page, 'Cambios pedidos')).toBeVisible();
  await expect(owner.page.getByText(NOTE)).toBeVisible();
  await owner.page.getByRole('button', { name: 'Corregir mis datos' }).click();
  await expect(owner.page.getByLabel(FOUNDING_VERIFICATION.taxIdLabel)).toHaveValue(
    FOUNDING_VERIFICATION.taxId,
  );
  await owner.page.getByLabel(FOUNDING_VERIFICATION.legalNameLabel).fill(CORRECTED_LEGAL_NAME);
  await owner.page.getByRole('button', { name: 'Guardar mis datos' }).click();
  await expect(
    owner.page.getByText('Guardamos tus datos. Hornilla los va a revisar de nuevo.'),
  ).toBeVisible();
  expect(await readDocument(`distributors/${id}/private/settings`)).toMatchObject({
    legalName: CORRECTED_LEGAL_NAME,
    taxId: FOUNDING_VERIFICATION.taxId,
  });
  await expectPage(visitor.page, listing, false);

  // The admin sees the correction and approves.
  await admin.page.reload();
  await expect(admin.page.getByText(CORRECTED_LEGAL_NAME)).toBeVisible();
  await approve(admin.page);
  await expectPage(visitor.page, listing, true);

  // Suspending hides the page again and leaves the office read-only.
  await decide(admin.page, 'Suspender', 'Sí, suspender', 'Distribuidora suspendida.');
  await expect(chip(admin.page, 'Aprobada, sin operar')).toBeVisible();
  await expect(chip(admin.page, 'Suspendida')).toBeVisible();
  await expectPage(visitor.page, listing, false);
  await expectInFinder(visitor.page, listing.name, false);
  await owner.page.reload();
  await expect(chip(owner.page, 'Sin operar')).toBeVisible();
  await expect(owner.page.getByText(/Tu distribuidora está en solo lectura/)).toBeVisible();
  expect(await readDocument(`distributors/${id}/private/control`)).toMatchObject({
    status: 'suspended',
    listingApproved: true,
  });

  // Reactivating shows it again: the approval was kept.
  await decide(admin.page, 'Reactivar', 'Sí, reactivar', 'Distribuidora reactivada.');
  await expectPage(visitor.page, listing, true);
  expect([...owner.errors, ...admin.errors, ...visitor.errors]).toEqual([]);
});
