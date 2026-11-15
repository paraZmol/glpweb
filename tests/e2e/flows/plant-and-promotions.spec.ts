import { expect, type Page } from '@playwright/test';
import { type Actors, DESKTOP, PHONE, runOncePerActorDevices, test } from '../support/actors';
import { readDocument, uniqueTag } from '../support/emulator-admin';
import { ownDistributor } from '../support/own-distributor';
import { signInAs } from '../support/sign-in';

test.skip(
  process.env.E2E_EMULATORS !== 'true',
  'Needs the seeded emulators: run with E2E_EMULATORS=true',
);
runOncePerActorDevices();
test.slow();

// PLAN 3.3–3.5: vehicles, plant stock and promotions, by role. Each test writes in a
// distributor of its own (seeded A is read by other specs at the same time).
const TEN = 'Balón 10 kg · Marca Flujo';
const PRODUCTS = [
  { id: 'p00', brand: 'Marca Flujo', weightKg: 10, refillPriceCents: 5200, fullPriceCents: 18500 },
  { id: 'p01', brand: 'Marca Flujo', weightKg: 5, refillPriceCents: 3800 },
];
const button = (page: Page, name: string | RegExp) => page.getByRole('button', { name });
const main = (page: Page) => page.getByRole('main');

async function shopOf(actors: Actors, tag: string) {
  const shop = await ownDistributor(tag, {
    products: PRODUCTS,
    staff: [
      { key: 'central', role: 'dispatcher' },
      { key: 'reparto', role: 'driver' },
    ],
  });
  const open = async (
    device: typeof DESKTOP | typeof PHONE,
    who: 'owner' | 'central' | 'reparto',
  ) => {
    const actor = await actors.open(device);
    const account = who === 'owner' ? shop.founder : shop.person(who);
    await signInAs(actor.page, account, who === 'reparto' ? '/reparto' : '/central');
    return actor;
  };
  return { shop, open };
}

test('the owner adds and edits vehicles; the driver reads them without a button', async ({
  actors,
}, testInfo) => {
  const { open } = await shopOf(actors, uniqueTag(testInfo));
  const owner = await open(DESKTOP, 'owner');
  const page = owner.page;
  await page.getByRole('link', { name: 'Vehículos' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tus vehículos.');
  await expect(page.getByText('Todavía no registras vehículos.')).toBeVisible();

  await button(page, 'Añadir tu primer vehículo').click();
  await page.getByLabel('Nombre').fill('Moto roja');
  await page.getByLabel('Placa (opcional)').fill('abc 123');
  await page.getByLabel('¿Cuántos balones lleva?').fill('dos');
  await button(page, 'Guardar vehículo').click();
  await expect(page.getByText(/en números enteros/)).toBeVisible();
  await page.getByLabel('¿Cuántos balones lleva?').fill('3');
  await button(page, 'Guardar vehículo').click();
  await expect(page.getByText('Añadimos Moto roja.')).toBeVisible();
  await expect(main(page).getByText('ABC123')).toBeVisible();

  // A second one with the same plate: the form warns, it does not block.
  await button(page, 'Añadir vehículo').click();
  await page.getByRole('radio', { name: 'Camión o camioneta' }).click();
  await page.getByLabel('Nombre').fill('Camión 1');
  await page.getByLabel('Placa (opcional)').fill('ABC123');
  await expect(page.getByText('Otro de tus vehículos ya tiene esa placa. Revísala.')).toBeVisible();
  await page.getByLabel('Placa (opcional)').fill('XYZ-900');
  await page.getByLabel('¿Cuántos balones lleva?').fill('120');
  await button(page, 'Guardar vehículo').click();
  await expect(page.getByText('Añadimos Camión 1.')).toBeVisible();

  await button(page, 'Editar Moto roja').click();
  await page.getByLabel('¿Cuántos balones lleva?').fill('4');
  await button(page, 'Guardar cambios').click();
  await expect(page.getByText('Guardamos los cambios de Moto roja.')).toBeVisible();
  await expect(main(page).getByText('Lleva hasta 4 balones')).toBeVisible();
  await button(page, 'Dejar de usar Camión 1').click();
  await expect(button(page, 'Volver a usar Camión 1')).toBeVisible();
  await expect(page.getByText('1 en uso · 1 sin usar · 2 de 30')).toBeVisible();

  const driver = await open(PHONE, 'reparto');
  await driver.page.getByRole('link', { name: 'Vehículos' }).click();
  await expect(driver.page).toHaveURL(/\/reparto\/vehiculos$/);
  await expect(main(driver.page).getByText('Lleva hasta 4 balones')).toBeVisible();
  await expect(main(driver.page).getByText('Sin usar')).toBeVisible();
  await expect(main(driver.page).getByRole('button')).toHaveCount(0);
  expect([...owner.errors, ...driver.errors]).toEqual([]);
});

test('the dispatcher adjusts the plant stock with a reason; the owner reads who did it', async ({
  actors,
}, testInfo) => {
  const { shop, open } = await shopOf(actors, uniqueTag(testInfo));
  const dispatcher = await open(DESKTOP, 'central');
  const page = dispatcher.page;
  await page.getByRole('link', { name: 'Stock' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Stock de planta.');
  await expect(page.getByText('Todavía no hay movimientos.')).toBeVisible();

  // A physical count is typed as totals; the screen says the difference before saving.
  await button(page, `Ajustar ${TEN}`).click();
  await page.getByLabel('Llenos contados').fill('40');
  await page.getByLabel('Vacíos contados').fill('12');
  await expect(page.getByText(/\+40 llenos · \+12 vacíos/)).toBeVisible();
  await button(page, 'Guardar ajuste').click();
  await expect(page.getByText(`Ajustamos el stock de ${TEN}.`)).toBeVisible();

  // "Otro motivo" needs a note.
  await button(page, `Ajustar ${TEN}`).click();
  await page.getByRole('radio', { name: /^Otro motivo/ }).click();
  await page.getByLabel('Cambio en llenos').fill('-2');
  await button(page, 'Guardar ajuste').click();
  await expect(page.getByText('Cuenta en una nota por qué ajustas el stock.')).toBeVisible();
  await page.getByLabel('Nota').fill('Préstamo a otra planta');
  await button(page, 'Guardar ajuste').click();
  await expect(page.getByText(`Ajustamos el stock de ${TEN}.`)).toBeVisible();
  await expect(page.getByText('En total: 38 llenos · 12 vacíos')).toBeVisible();

  const stored = await readDocument(`distributors/${shop.id}/plantStock/p00`);
  expect(stored).toMatchObject({ full: 38, empty: 12 });

  const owner = await open(DESKTOP, 'owner');
  await owner.page.goto('/central/stock');
  await expect(owner.page.getByText('“Préstamo a otra planta”')).toBeVisible();
  await expect(
    owner.page.getByText(`Lo hizo ${shop.person('central').displayName}`).first(),
  ).toBeVisible();
  expect([...owner.errors, ...dispatcher.errors]).toEqual([]);
});

test('the driver never sees the plant stock: no link, no route', async ({ actors }, testInfo) => {
  const { open } = await shopOf(actors, uniqueTag(testInfo));
  for (const device of [PHONE, DESKTOP]) {
    const driver = await open(device, 'reparto');
    const nav = driver.page.getByRole('navigation', { name: 'Principal' });
    await expect(nav.getByRole('link', { name: 'Vehículos' })).toBeVisible();
    await expect(nav.getByRole('link', { name: /Stock|Planta/ })).toHaveCount(0);
    await driver.page.goto('/central/stock');
    await expect(driver.page).toHaveURL(/\/reparto$/);
    await driver.page.goto('/reparto/stock');
    await expect(driver.page.getByText('Error 404')).toBeVisible();
    expect(driver.errors).toEqual([]);
  }
});

test('the owner publishes, extends and switches off a promotion; the driver reads it', async ({
  actors,
}, testInfo) => {
  const { shop, open } = await shopOf(actors, uniqueTag(testInfo));
  const owner = await open(DESKTOP, 'owner');
  const page = owner.page;
  await page.getByRole('link', { name: 'Promociones' }).click();
  await expect(page.getByText('Todavía no tienes promociones.')).toBeVisible();
  await button(page, 'Añadir promoción').click();
  await button(page, /^S\/ menos/).click();

  // No invented urgency in the conditions (marketing H5).
  await page.getByLabel('Condiciones (opcional)').fill('Hasta agotar stock');
  await expect(page.getByText('Ahorras S/ 5.00')).toBeVisible();
  await expect(page.getByText(/Dejas de cobrar S\/ 5\.00 por cada recarga/)).toBeVisible();
  await button(page, 'Publicar promoción').click();
  await expect(page.getByText(/Esa frase no se puede usar/)).toBeVisible();
  await page.getByLabel('Condiciones (opcional)').fill('Solo pedidos por Hornilla.');
  await button(page, 'Publicar promoción').click();
  await expect(page.getByText('Publicamos “S/ 5 menos”.')).toBeVisible();
  await expect(main(page).getByText('Activa', { exact: true })).toBeVisible();
  const product = await readDocument(`distributors/${shop.id}/products/p00`);
  expect(product?.promotedUntil).toBeTruthy();

  // The driver sees it, without a button.
  const driver = await open(PHONE, 'reparto');
  await driver.page.goto('/reparto/promociones');
  await expect(main(driver.page).getByText('S/ 5.00 menos en cada recarga')).toBeVisible();
  await expect(main(driver.page).getByRole('button')).toHaveCount(0);

  await button(page, 'Editar S/ 5 menos').click();
  await page.getByRole('radio', { name: '3 días más' }).click();
  await button(page, 'Guardar cambios').click();
  await expect(page.getByText('Guardamos los cambios de “S/ 5 menos”.')).toBeVisible();

  await button(page, 'Apagar S/ 5 menos').click();
  await expect(page.getByText('¿Apagar esta promoción ahora?')).toBeVisible();
  await button(page, 'Sí, apagarla').click();
  await expect(page.getByText('Apagamos “S/ 5 menos”.')).toBeVisible();
  await expect(main(page).getByText('Apagada', { exact: true })).toBeVisible();
  await button(page, 'Repetir S/ 5 menos').click();
  await expect(page.getByRole('heading', { name: 'Repetir “S/ 5 menos”.' })).toBeVisible();
  expect([...owner.errors, ...driver.errors]).toEqual([]);
});

test('the dispatcher saves a risky promotion without publishing, then publishes it', async ({
  actors,
}, testInfo) => {
  const { open } = await shopOf(actors, uniqueTag(testInfo));
  const dispatcher = await open(DESKTOP, 'central');
  const page = dispatcher.page;
  await page.goto('/central/promociones');
  await button(page, 'Añadir promoción').click();
  await button(page, /^Balón completo al precio del gas/).click();
  await expect(page.getByText('Vas a entregar el envase sin cobrarlo.')).toBeVisible();
  await page.getByLabel('Tope total de unidades').fill('10');
  await button(page, 'Publicar promoción').click();
  await expect(page.getByText(/Marca "Entiendo y quiero publicarla"/)).toBeVisible();
  await button(page, 'Guardar sin publicar').click();
  await expect(page.getByText('Guardamos “Envase al precio del gas” sin publicar.')).toBeVisible();
  await expect(main(page).getByText('Sin publicar', { exact: true })).toBeVisible();
  await button(page, 'Publicar Envase al precio del gas').click();
  await expect(page.getByText('Publicamos “Envase al precio del gas”.')).toBeVisible();
  await expect(main(page).getByText('Activa', { exact: true })).toBeVisible();
  expect(dispatcher.errors).toEqual([]);
});

test('a suspended distributor shows vehicles, stock and promotions without a button', async ({
  actors,
}) => {
  const { page, errors } = await actors.openSeed('ownerC');
  for (const path of ['/central/vehiculos', '/central/stock', '/central/promociones']) {
    await page.goto(path);
    await expect(page.getByText(/Hornilla suspendió tu distribuidora/)).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(main(page).getByRole('button')).toHaveCount(0);
  }
  expect(errors).toEqual([]);
});
