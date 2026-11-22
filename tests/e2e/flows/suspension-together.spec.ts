import { expect, type Page } from '@playwright/test';
import { type Actor, DESKTOP, PHONE, runOncePerActorDevices, test } from '../support/actors';
import { readDocument, uniqueTag } from '../support/emulator-admin';
import { catalogRow } from '../support/flow-helpers';
import { type OwnDistributor, ownDistributor } from '../support/own-distributor';
import { signInAs, signInAsSeedUser } from '../support/sign-in';

test.skip(
  process.env.E2E_EMULATORS !== 'true',
  'Needs the seeded emulators: run with E2E_EMULATORS=true',
);
runOncePerActorDevices();
// Five people, each loading the app cold.
test.slow();

// PLAN 3.1/3.2 and 2.11: a suspension from the platform reaches every open panel of the
// distributor without a reload, and leaves it read-only under the notice.

const CATALOG_PATH = '/central/catalogo';
const STAFF_PATH = '/central/personal';
const OFFICE_NOTICE = /Hornilla suspendió tu distribuidora: está en solo lectura/;
const TEN = 'Balón 10 kg · Marca Flujo';
const PRODUCTS = [{ id: 'p00', brand: 'Marca Flujo', weightKg: 10, refillPriceCents: 5000 }];

const button = (page: Page, name: string | RegExp) =>
  page.getByRole('button', { name, exact: true });
const allErrors = (...people: Actor[]) => people.flatMap((person) => person.errors);

/** The platform admin suspends `shop` from its review page. */
async function suspend(admin: Page, shop: OwnDistributor) {
  await admin.goto(`/plataforma/altas/${shop.id}`);
  await button(admin, 'Suspender').click();
  await button(admin, 'Sí, suspender').click();
  await expect(admin.getByText('Distribuidora suspendida.')).toBeVisible();
}

test('suspended while its people work: the owner’s open form, the dispatcher’s list, the owner’s staff and the driver’s catalogue turn read-only at once', async ({
  actors,
}, testInfo) => {
  const shop = await ownDistributor(uniqueTag(testInfo), {
    products: PRODUCTS,
    staff: [
      { key: 'central', role: 'dispatcher' },
      { key: 'reparto', role: 'driver' },
      { key: 'socia', role: 'owner' },
    ],
  });
  const owner = await actors.open(DESKTOP);
  await signInAs(owner.page, shop.founder, '/central');
  await owner.page.goto(CATALOG_PATH);
  await button(owner.page, `Editar ${TEN}`).click();
  await owner.page.getByLabel('Precio de la recarga (S/)').fill('61');
  const dispatcher = await actors.open(DESKTOP);
  await signInAs(dispatcher.page, shop.person('central'), '/central');
  await dispatcher.page.goto(CATALOG_PATH);
  await expect(button(dispatcher.page, 'Añadir producto')).toBeVisible();
  const partner = await actors.open(DESKTOP);
  await signInAs(partner.page, shop.person('socia'), '/central');
  await partner.page.goto(STAFF_PATH);
  await button(partner.page, 'Invitar a alguien').click();
  await expect(button(partner.page, 'Crear invitación')).toBeVisible();
  const driver = await actors.open(PHONE);
  await signInAs(driver.page, shop.person('reparto'), '/reparto');
  await driver.page.goto('/reparto/catalogo');
  await expect(catalogRow(driver.page, TEN)).toBeVisible();

  const admin = await actors.open(DESKTOP);
  await signInAsSeedUser(admin.page, 'admin');
  await suspend(admin.page, shop);

  // Nobody reloads.
  for (const page of [owner.page, dispatcher.page, partner.page]) {
    await expect(page.getByText(OFFICE_NOTICE).first()).toBeVisible();
  }
  await expect(
    driver.page.getByText(`Hornilla suspendió ${shop.name}`, { exact: false }),
  ).toBeVisible();
  // No way left to write: the open form, the list controls, the invitation form.
  await expect(button(owner.page, 'Guardar cambios')).toHaveCount(0);
  await expect(owner.page.getByRole('main').getByRole('button')).toHaveCount(0);
  await expect(dispatcher.page.getByRole('main').getByRole('button')).toHaveCount(0);
  await expect(button(partner.page, 'Crear invitación')).toHaveCount(0);
  await expect(button(partner.page, 'Invitar a alguien')).toHaveCount(0);
  await expect(partner.page.getByLabel('Nombre del ayudante')).toHaveCount(0);
  // The catalogue stays in sight, as it is stored.
  for (const page of [owner.page, dispatcher.page, driver.page]) {
    await expect(catalogRow(page, TEN)).toContainText('S/ 50.00');
  }
  expect((await readDocument(`distributors/${shop.id}/products/p00`))?.refillPriceCents).toBe(5000);

  // A visitor no longer finds the page.
  const visitor = await actors.open(PHONE);
  await visitor.page.goto(`/d/${shop.slug}`);
  await expect(visitor.page.getByText('Esta distribuidora no existe.')).toBeVisible();
  expect(allErrors(owner, dispatcher, partner, driver, admin, visitor)).toEqual([]);
});

test('the owner saves a price at the moment it is suspended: the screen and the database agree', async ({
  actors,
}, testInfo) => {
  const shop = await ownDistributor(uniqueTag(testInfo), { products: PRODUCTS });
  const owner = await actors.open(DESKTOP);
  await signInAs(owner.page, shop.founder, '/central');
  await owner.page.goto(CATALOG_PATH);
  await button(owner.page, `Editar ${TEN}`).click();
  await owner.page.getByLabel('Precio de la recarga (S/)').fill('61');
  const admin = await actors.open(DESKTOP);
  await signInAsSeedUser(admin.page, 'admin');
  await admin.page.goto(`/plataforma/altas/${shop.id}`);
  await button(admin.page, 'Suspender').click();

  await Promise.all([
    button(owner.page, 'Guardar cambios').click(),
    button(admin.page, 'Sí, suspender').click(),
  ]);

  await expect(admin.page.getByText('Distribuidora suspendida.')).toBeVisible();
  await expect(owner.page.getByText(OFFICE_NOTICE).first()).toBeVisible();
  await expect(owner.page.getByRole('main').getByRole('button')).toHaveCount(0);
  // Whichever reached the server first, the list shows what is stored.
  const stored = Number(
    (await readDocument(`distributors/${shop.id}/products/p00`))?.refillPriceCents,
  );
  await expect(catalogRow(owner.page, TEN)).toContainText(`S/ ${(stored / 100).toFixed(2)}`);
  expect(allErrors(owner, admin)).toEqual([]);
});
