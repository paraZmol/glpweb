import { expect, type Locator, type Page } from '@playwright/test';
import { SEED_DISTRIBUTORS } from '../../seed/data';
import {
  type Actor,
  type Actors,
  DESKTOP,
  PHONE,
  runOncePerActorDevices,
  test,
} from '../support/actors';
import {
  createTestAccount,
  readDocument,
  uniqueTag,
  writeDocument,
} from '../support/emulator-admin';
import { foundDistributor, FOUNDING_PLANT } from '../support/founding';
import { signInAs } from '../support/sign-in';

test.skip(
  process.env.E2E_EMULATORS !== 'true',
  'Needs the seeded emulators: run with E2E_EMULATORS=true',
);
runOncePerActorDevices();
// A whole sign-up (and, for the first flow, an approval) before the catalogue starts.
test.slow();

const CATALOG_PATH = '/central/catalogo';
const STAFF_READS =
  'Los productos y los precios los cambian el titular y la central. Aquí los ves tal como están, también los que no están a la venta.';
const NOT_ABOVE = 'El balón completo lleva gas y envase: debe costar más que la recarga.';
const CATALOG_FULL = 'Puedes tener hasta 30 productos, también los que no están a la venta.';
const MAX_PRODUCTS = 30;

const button = (page: Page, name: string | RegExp) => page.getByRole('button', { name });
/** The names of the products, in the order the screen lists them. */
const productNames = (scope: Page | Locator) => scope.getByRole('heading', { level: 3 });

interface NewProduct {
  brand: string;
  weight: string;
  refill: string;
  full?: string;
}

/** Fills the product form that is open; the caller saves it. */
async function fillProduct(page: Page, { brand, weight, refill, full }: NewProduct) {
  await page.getByLabel('Marca del gas').fill(brand);
  await page.getByRole('radio', { name: weight, exact: true }).click();
  await page.getByLabel('Precio de la recarga (S/)').fill(refill);
  if (full === undefined) return;
  await page.getByRole('checkbox', { name: /También vendo balón completo/ }).check();
  await page.getByLabel('Precio del balón completo (S/)').fill(full);
}

async function addProduct(page: Page, product: NewProduct, title: string) {
  await button(page, /^Añadir (tu primer )?producto$/).click();
  await fillProduct(page, product);
  await button(page, 'Guardar producto').click();
  await expect(page.getByText(`Añadimos ${title} a tu catálogo.`)).toBeVisible();
}

/** A distributor founded through the screen by an account of its own, its owner on the office. */
async function foundedOwner(actors: Actors, tag: string) {
  const account = await createTestAccount(tag);
  const name = `Gas Catálogo ${tag}`;
  const slug = `catalogo-${tag}`;
  const owner = await actors.open(DESKTOP);
  await signInAs(owner.page, account, '/inicio');
  await foundDistributor(owner.page, { name, slug });
  const link = await readDocument(`slugs/${slug}`);
  return { owner, name, slug, id: String(link?.distributorId) };
}

async function approve(actors: Actors, id: string): Promise<Actor> {
  const admin = await actors.openSeed('admin');
  await admin.page.goto(`/plataforma/altas/${id}`);
  await button(admin.page, 'Aprobar').click();
  await button(admin.page, 'Sí, aprobar').click();
  await expect(admin.page.getByText('Ficha aprobada.')).toBeVisible();
  return admin;
}

// PLAN 3.1: the owner loads the catalogue; visitors see what is on sale, in its order and at
// its prices, and the finder says the cheapest refill.
test('the owner loads, edits, orders and withdraws products; visitors see exactly that', async ({
  actors,
}, testInfo) => {
  const { owner, name, slug, id } = await foundedOwner(actors, uniqueTag(testInfo));
  const admin = await approve(actors, id);
  const page = owner.page;
  await page.getByRole('link', { name: 'Cargar catálogo' }).click();
  await expect(page).toHaveURL(new RegExp(`${CATALOG_PATH}$`));
  await expect(page.getByText('Todavía no cargas ningún balón.')).toBeVisible();

  // A full cylinder that does not cost more than the refill is refused on its own field.
  await button(page, 'Añadir tu primer producto').click();
  await fillProduct(page, {
    brand: 'Marca Ensayo',
    weight: '10 kg',
    refill: '52,50',
    full: '52.5',
  });
  await button(page, 'Guardar producto').click();
  await expect(page.getByText(NOT_ABOVE)).toBeVisible();
  await expect(page.getByLabel('Precio del balón completo (S/)')).toHaveAttribute(
    'aria-invalid',
    'true',
  );
  await page.getByLabel('Precio del balón completo (S/)').fill('185');
  await button(page, 'Guardar producto').click();
  await expect(page.getByText('Añadimos Balón 10 kg · Marca Ensayo a tu catálogo.')).toBeVisible();
  await addProduct(
    page,
    { brand: 'Marca Otra', weight: '5 kg', refill: '38' },
    'Balón 5 kg · Marca Otra',
  );
  await addProduct(
    page,
    { brand: 'Marca Tercera', weight: '15 kg', refill: '70' },
    'Balón 15 kg · Marca Tercera',
  );

  // Edit a price, move a product up, take one off sale.
  await button(page, 'Editar Balón 10 kg · Marca Ensayo').click();
  await page.getByLabel('Precio de la recarga (S/)').fill('50');
  await button(page, 'Guardar cambios').click();
  await expect(
    page.getByText('Guardamos los cambios de Balón 10 kg · Marca Ensayo.'),
  ).toBeVisible();
  await button(page, 'Subir Balón 5 kg · Marca Otra').click();
  await expect(productNames(page)).toHaveText([
    'Balón 5 kg · Marca Otra',
    'Balón 10 kg · Marca Ensayo',
    'Balón 15 kg · Marca Tercera',
  ]);
  // The focus stays on the control that moved it, for whoever reorders with the keyboard.
  await expect(button(page, 'Bajar Balón 5 kg · Marca Otra')).toBeFocused();
  await button(page, 'Quitar de la venta Balón 15 kg · Marca Tercera').click();
  await expect(button(page, 'Poner a la venta Balón 15 kg · Marca Tercera')).toBeVisible();
  await expect(page.getByText('2 a la venta · 1 fuera de venta · 3 de 30')).toBeVisible();

  // The office home marks the task done.
  await page.getByRole('link', { name: 'Monitor' }).click();
  await expect(page.getByText('Carga tu catálogo (hecho)')).toBeAttached();

  // A visitor on a phone: only what is on sale, in that order, at those prices.
  const visitor = await actors.open(PHONE);
  await visitor.page.goto(`/d/${slug}`);
  const products = visitor.page.getByRole('region', { name: 'Balones y precios' });
  await expect(productNames(products)).toHaveText(['Balón 5 kg', 'Balón 10 kg']);
  await expect(products.getByRole('article').first()).toContainText('S/ 38.00');
  await expect(products.getByRole('article').first()).toContainText(
    'Solo recarga. Esta distribuidora no vende envases de este balón.',
  );
  await expect(products.getByRole('radio', { name: /Recarga S\/ 50\.00/ })).toBeChecked();
  await expect(products.getByRole('radio', { name: /Balón completo S\/ 185\.00/ })).toBeVisible();
  await expect(visitor.page.getByText('Marca Tercera')).toHaveCount(0);
  await expect(visitor.page.getByRole('button', { name: /^Pedir/ })).toHaveCount(0);

  // The finder, from the door of the plant: the cheapest refill on sale.
  await visitor.context.grantPermissions(['geolocation']);
  await visitor.context.setGeolocation({
    latitude: Number(FOUNDING_PLANT.latitude),
    longitude: Number(FOUNDING_PLANT.longitude),
  });
  await visitor.page.goto('/');
  await button(visitor.page, 'Usar mi ubicación').click();
  const card = visitor.page.getByRole('article').filter({ hasText: name });
  await expect(card).toContainText('Recarga 5 kg desde');
  await expect(card).toContainText('S/ 38.00');
  await expect(card).toContainText('Marca Otra · Marca Ensayo');
  expect([...owner.errors, ...admin.errors, ...visitor.errors]).toEqual([]);
});

// PLAN §11, 2026-10-15: the dispatcher sets products and prices too, like the owner.
test('the dispatcher sees the whole catalogue and can change it', async ({ actors }) => {
  const { page, errors } = await actors.openSeed('dispatcherA');
  await page.getByRole('link', { name: 'Catálogo' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tu catálogo.');
  await expect(page.getByText(STAFF_READS)).toHaveCount(0);
  await expect(productNames(page)).toHaveCount(SEED_DISTRIBUTORS.a.products.length);
  await expect(page.getByText('Fuera de venta', { exact: true })).toBeVisible();
  await expect(button(page, 'Añadir producto')).toBeVisible();
  expect(errors).toEqual([]);
});

// The seeded catalogue of A is read by other specs: the dispatcher writes in a distributor of
// its own test, where it works as it would after accepting an invitation (PLAN 3.2).
test('a dispatcher adds a product to the catalogue of its distributor', async ({
  actors,
}, testInfo) => {
  const tag = uniqueTag(testInfo);
  const { owner, name, id } = await foundedOwner(actors, tag);
  const account = await createTestAccount(`${tag}-central`);
  const now = new Date();
  await writeDocument(`distributors/${id}/members/${account.uid}`, {
    uid: account.uid,
    distributorId: id,
    role: 'dispatcher',
    active: true,
    displayName: account.displayName,
    distributorName: name,
    createdAt: now,
    updatedAt: now,
  });
  const dispatcher = await actors.open(DESKTOP);
  await signInAs(dispatcher.page, account, '/central');
  await dispatcher.page.getByRole('link', { name: 'Catálogo' }).click();

  await expect(dispatcher.page.getByRole('heading', { level: 1 })).toHaveText('Tu catálogo.');
  await addProduct(
    dispatcher.page,
    { brand: 'Marca Central', weight: '10 kg', refill: '41' },
    'Balón 10 kg · Marca Central',
  );

  const stored = await readDocument(`distributors/${id}/products/p00`);
  expect(stored).toMatchObject({ brand: 'Marca Central', refillPriceCents: 4100 });
  expect([...owner.errors, ...dispatcher.errors]).toEqual([]);
});

// PLAN 3.1: a suspended distributor keeps its catalogue in sight and nothing else.
test('a suspended distributor sees its catalogue read-only, under the notice', async ({
  actors,
}) => {
  const { page, errors } = await actors.openSeed('ownerC');
  await page.goto(CATALOG_PATH);
  await expect(page.getByText(/Hornilla suspendió tu distribuidora/)).toBeVisible();
  await expect(page.getByText('Todavía no hay productos.')).toBeVisible();
  await expect(page.getByRole('main').getByRole('button')).toHaveCount(0);
  expect(errors).toEqual([]);
});

// PLAN 3.1: thirty slots per distributor, withdrawn products included.
test('the thirtieth product fills the catalogue and the limit replaces the button', async ({
  actors,
}, testInfo) => {
  const { owner, id } = await foundedOwner(actors, uniqueTag(testInfo));
  const now = new Date();
  for (let slot = 0; slot < MAX_PRODUCTS - 1; slot += 1) {
    await writeDocument(`distributors/${id}/products/p${String(slot).padStart(2, '0')}`, {
      brand: `Marca ${slot}`,
      brandColor: null,
      weightKg: 10,
      name: 'Balón 10 kg',
      refillPriceCents: 5000 + slot,
      fullPriceCents: null,
      currency: 'PEN',
      active: slot % 2 === 0,
      sortOrder: slot,
      createdAt: now,
      updatedAt: now,
    });
  }
  await owner.page.goto(CATALOG_PATH);
  await expect(owner.page.getByText('29 de 30')).toBeVisible();
  await addProduct(
    owner.page,
    { brand: 'Marca Última', weight: '45 kg', refill: '190' },
    'Balón 45 kg · Marca Última',
  );
  await expect(owner.page.getByText('30 de 30')).toBeVisible();
  await expect(owner.page.getByText(CATALOG_FULL)).toBeVisible();
  await expect(button(owner.page, 'Añadir producto')).toHaveCount(0);
  expect(owner.errors).toEqual([]);
});
