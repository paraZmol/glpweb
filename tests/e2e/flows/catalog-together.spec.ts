import { expect, type Page, type Route } from '@playwright/test';
import {
  type Actor,
  type Actors,
  DESKTOP,
  PHONE,
  runOncePerActorDevices,
  test,
} from '../support/actors';
import { readDocument, uniqueTag } from '../support/emulator-admin';
import { catalogRow, comeBack, comeBackUntil, finderCard, standAt } from '../support/flow-helpers';
import { ownDistributor } from '../support/own-distributor';
import { signInAs } from '../support/sign-in';

test.skip(
  process.env.E2E_EMULATORS !== 'true',
  'Needs the seeded emulators: run with E2E_EMULATORS=true',
);
runOncePerActorDevices();
// Three or four people, each loading the app cold.
test.slow();

// PLAN 3.1 and §11 (2026-10-15): the owner and the dispatcher both write the catalogue. It is
// not followed live: each screen reads it again when its person comes back to it.

const CATALOG_PATH = '/central/catalogo';
const TEN = 'Balón 10 kg · Marca Flujo';
const FIVE = 'Balón 5 kg · Marca Flujo';
/** The Firestore commit of a transaction: the moment a write reaches the server. */
const COMMIT = /documents:commit/;

const PRODUCTS = [
  { id: 'p00', brand: 'Marca Flujo', weightKg: 10, refillPriceCents: 5000, fullPriceCents: 17500 },
  { id: 'p01', brand: 'Marca Flujo', weightKg: 5, refillPriceCents: 4000 },
];

const button = (page: Page, name: string | RegExp) => page.getByRole('button', { name });

/** The owner and the dispatcher of a distributor of this test, both on the catalogue. */
async function officeOf(actors: Actors, tag: string) {
  const shop = await ownDistributor(tag, {
    products: PRODUCTS,
    staff: [{ key: 'central', role: 'dispatcher' }],
  });
  const owner = await actors.open(DESKTOP);
  await signInAs(owner.page, shop.founder, '/central');
  await owner.page.goto(CATALOG_PATH);
  const dispatcher = await actors.open(DESKTOP);
  await signInAs(dispatcher.page, shop.person('central'), '/central');
  await dispatcher.page.goto(CATALOG_PATH);
  for (const { page } of [owner, dispatcher]) {
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tu catálogo.');
    await expect(catalogRow(page, FIVE)).toContainText('S/ 40.00');
  }
  return { shop, owner, dispatcher };
}

async function editRefill(page: Page, title: string, price: string) {
  await button(page, `Editar ${title}`).click();
  await page.getByLabel('Precio de la recarga (S/)').fill(price);
}

/** The visitor's view of the distributor's page: its product cards, by name. */
const publicProducts = (page: Page) =>
  page.getByRole('region', { name: 'Balones y precios' }).getByRole('heading', { level: 3 });

function allErrors(...people: Actor[]) {
  return people.flatMap((person) => person.errors);
}

test('owner and dispatcher see each other’s changes when they come back to the catalogue; visitors on reload', async ({
  actors,
}, testInfo) => {
  const { shop, owner, dispatcher } = await officeOf(actors, uniqueTag(testInfo));
  const visitor = await actors.open(PHONE);
  await visitor.page.goto(`/d/${shop.slug}`);
  await expect(publicProducts(visitor.page)).toHaveText(['Balón 10 kg', 'Balón 5 kg']);

  // The owner lowers the cheapest refill.
  await editRefill(owner.page, FIVE, '36');
  await button(owner.page, 'Guardar cambios').click();
  await expect(owner.page.getByText(`Guardamos los cambios de ${FIVE}.`)).toBeVisible();
  await expect(catalogRow(owner.page, FIVE)).toContainText('S/ 36.00');
  // Not live, by design: the dispatcher's screen still says 40 until it comes back to it.
  await expect(catalogRow(dispatcher.page, FIVE)).toContainText('S/ 40.00');
  await comeBackUntil(dispatcher.page, () =>
    expect(catalogRow(dispatcher.page, FIVE)).toContainText('S/ 36.00', { timeout: 1_000 }),
  );

  // The dispatcher takes the 10 kg off sale; the owner sees it on return.
  await button(dispatcher.page, `Quitar de la venta ${TEN}`).click();
  await expect(
    dispatcher.page.getByText(`${TEN} ya no está a la venta. Tus clientes no lo ven.`),
  ).toBeVisible();
  await comeBackUntil(owner.page, () =>
    expect(button(owner.page, `Poner a la venta ${TEN}`)).toBeVisible({ timeout: 1_000 }),
  );

  // The visitor who was already on the page keeps what it loaded (the public page reads the
  // catalogue once and not on return either) and sees the change on reload.
  await comeBack(visitor.page);
  await expect(publicProducts(visitor.page)).toHaveText(['Balón 10 kg', 'Balón 5 kg']);
  await visitor.page.reload();
  await expect(publicProducts(visitor.page)).toHaveText(['Balón 5 kg']);
  await expect(visitor.page.getByText('S/ 36.00').first()).toBeVisible();
  await expect(visitor.page.getByText('recarga 5 kg desde', { exact: true })).toBeVisible();

  // The finder says the cheapest refill on sale, with its weight.
  await standAt(visitor.page, shop.plant);
  const card = await finderCard(visitor.page, shop.name);
  await expect(card).toContainText('Recarga 5 kg desde');
  await expect(card).toContainText('S/ 36.00');
  const profile = await readDocument(`distributors/${shop.id}`);
  expect(profile).toMatchObject({ priceFromCents: 3600, priceFromWeightKg: 5 });
  expect(allErrors(owner, dispatcher, visitor)).toEqual([]);
});

test('a product taken off sale while a visitor is on the page stays on that visitor’s screen until it reloads', async ({
  actors,
}, testInfo) => {
  const shop = await ownDistributor(uniqueTag(testInfo), { products: PRODUCTS });
  const visitor = await actors.open(PHONE);
  await visitor.page.goto(`/d/${shop.slug}`);
  await expect(publicProducts(visitor.page)).toHaveText(['Balón 10 kg', 'Balón 5 kg']);
  const owner = await actors.open(DESKTOP);
  await signInAs(owner.page, shop.founder, '/central');
  await owner.page.goto(CATALOG_PATH);

  await button(owner.page, `Quitar de la venta ${FIVE}`).click();
  await expect(button(owner.page, `Poner a la venta ${FIVE}`)).toBeVisible();

  // Documented behaviour (not a promise of the plan either way): nothing tells the visitor.
  await comeBack(visitor.page);
  await expect(publicProducts(visitor.page)).toHaveText(['Balón 10 kg', 'Balón 5 kg']);
  await visitor.page.reload();
  await expect(publicProducts(visitor.page)).toHaveText(['Balón 10 kg']);
  await expect(visitor.page.getByText('recarga 10 kg desde', { exact: true })).toBeVisible();
  expect(allErrors(owner, visitor)).toEqual([]);
});

test('owner and dispatcher add a product at the same moment: both are saved, each in its own slot', async ({
  actors,
}, testInfo) => {
  const { shop, owner, dispatcher } = await officeOf(actors, uniqueTag(testInfo));
  const fill = async (page: Page, brand: string) => {
    await button(page, 'Añadir producto').click();
    await page.getByLabel('Marca del gas').fill(brand);
    await page.getByRole('radio', { name: '15 kg', exact: true }).click();
    await page.getByLabel('Precio de la recarga (S/)').fill('70');
  };
  await fill(owner.page, 'Marca Titular');
  await fill(dispatcher.page, 'Marca Central');

  await Promise.all([
    button(owner.page, 'Guardar producto').click(),
    button(dispatcher.page, 'Guardar producto').click(),
  ]);

  // The free slot is chosen inside the transaction: both are saved, each in its own slot.
  const added = (brand: string) => `Añadimos Balón 15 kg · ${brand} a tu catálogo.`;
  await expect(owner.page.getByText(added('Marca Titular'))).toBeVisible();
  await expect(dispatcher.page.getByText(added('Marca Central'))).toBeVisible();
  const brands = await Promise.all(
    ['p02', 'p03'].map(
      async (slot) => (await readDocument(`distributors/${shop.id}/products/${slot}`))?.brand,
    ),
  );
  expect(brands.sort()).toEqual(['Marca Central', 'Marca Titular']);
  expect(await readDocument(`distributors/${shop.id}/products/p04`)).toBeNull();
  expect(allErrors(owner, dispatcher)).toEqual([]);
});

/**
 * Holds every commit of `page` until `release` resolves: a slow connection that sends its write
 * late, after it read the catalogue.
 */
async function holdCommits(page: Page, release: Promise<void>) {
  const held: Promise<void>[] = [];
  let seen!: () => void;
  const firstHeld = new Promise<void>((resolve) => {
    seen = resolve;
  });
  await page.route(COMMIT, async (route: Route) => {
    seen();
    const done = release.then(() => route.continue());
    held.push(done);
    await done;
  });
  return { firstHeld };
}

// Fixed bug (ALTO, flow-tester 2026-10-16): overlapping catalogue writes used to leave a stale
// "desde" in the public profile. Here the owner's write is held until the dispatcher's lands.
test('two catalogue writes that overlap leave the finder’s "desde" in line with what is on sale', async ({
  actors,
}, testInfo) => {
  const { shop, owner, dispatcher } = await officeOf(actors, uniqueTag(testInfo));
  let release!: () => void;
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  const { firstHeld } = await holdCommits(owner.page, released);

  // The owner's write leaves first, but reaches the server last.
  await button(owner.page, `Quitar de la venta ${FIVE}`).click();
  await firstHeld;
  await editRefill(dispatcher.page, TEN, '55');
  await button(dispatcher.page, 'Guardar cambios').click();
  await expect(dispatcher.page.getByText(`Guardamos los cambios de ${TEN}.`)).toBeVisible();
  release();
  await expect(button(owner.page, `Poner a la venta ${FIVE}`)).toBeVisible();

  // The database: only the 10 kg is on sale, at 55.
  expect(await readDocument(`distributors/${shop.id}/products/p00`)).toMatchObject({
    refillPriceCents: 5500,
    active: true,
  });
  expect((await readDocument(`distributors/${shop.id}/products/p01`))?.active).toBe(false);
  // What a visitor reads: the page and the finder must agree with that.
  const visitor = await actors.open(PHONE);
  await standAt(visitor.page, shop.plant);
  const card = await finderCard(visitor.page, shop.name);
  await expect(card).toContainText('Recarga 10 kg desde');
  await expect(card).toContainText('S/ 55.00');
  expect(await readDocument(`distributors/${shop.id}`)).toMatchObject({ priceFromCents: 5500 });
});
