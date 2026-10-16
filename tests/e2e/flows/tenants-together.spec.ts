import { expect, type Page } from '@playwright/test';
import { type Actor, DESKTOP, PHONE, runOncePerActorDevices, test } from '../support/actors';
import { uniqueTag } from '../support/emulator-admin';
import { catalogRow } from '../support/flow-helpers';
import { ownDistributor } from '../support/own-distributor';
import { signInAs } from '../support/sign-in';

test.skip(
  process.env.E2E_EMULATORS !== 'true',
  'Needs the seeded emulators: run with E2E_EMULATORS=true',
);
runOncePerActorDevices();
// Five people of two distributors, each loading the app cold.
test.slow();

// testing-strategy §3.5 and CLAUDE.md rule 1: two distributors working at the same moment never
// see each other's catalogue, staff, invitations or helpers, on any screen.

const STAFF_PATH = '/central/personal';
const CATALOG_PATH = '/central/catalogo';
const ONLY_A = 'Marca Solo A';
const HELPER_A = 'R. Ayudante De A';

const button = (page: Page, name: string | RegExp) => page.getByRole('button', { name });
const allErrors = (...people: Actor[]) => people.flatMap((person) => person.errors);

test('A changes its catalogue, staff and helpers while B works: B never sees any of it, not even by pointing its selection at A', async ({
  actors,
}, testInfo) => {
  const tag = uniqueTag(testInfo);
  const shopA = await ownDistributor(`${tag}-a`, {
    products: [{ id: 'p00', brand: 'Marca De A', weightKg: 10, refillPriceCents: 5000 }],
  });
  const shopB = await ownDistributor(`${tag}-b`, {
    products: [{ id: 'p00', brand: 'Marca De B', weightKg: 10, refillPriceCents: 4900 }],
    staff: [{ key: 'central', role: 'dispatcher' }],
  });
  const ownerA = await actors.open(DESKTOP);
  await signInAs(ownerA.page, shopA.founder, '/central');
  const ownerB = await actors.open(DESKTOP);
  await signInAs(ownerB.page, shopB.founder, '/central');
  await ownerB.page.goto(STAFF_PATH);
  const dispatcherB = await actors.open(DESKTOP);
  await signInAs(dispatcherB.page, shopB.person('central'), '/central');
  await dispatcherB.page.goto(CATALOG_PATH);
  await expect(catalogRow(dispatcherB.page, 'Balón 10 kg · Marca De B')).toBeVisible();

  // A: a product, an invitation tied to an address, a helper.
  await ownerA.page.goto(CATALOG_PATH);
  await button(ownerA.page, 'Añadir producto').click();
  await ownerA.page.getByLabel('Marca del gas').fill(ONLY_A);
  await ownerA.page.getByRole('radio', { name: '5 kg', exact: true }).click();
  await ownerA.page.getByLabel('Precio de la recarga (S/)').fill('30');
  await button(ownerA.page, 'Guardar producto').click();
  await expect(
    ownerA.page.getByText(`Añadimos Balón 5 kg · ${ONLY_A} a tu catálogo.`),
  ).toBeVisible();
  await ownerA.page.goto(STAFF_PATH);
  const invitedEmail = `solo-a-${tag}@example.com`;
  await button(ownerA.page, 'Invitar a alguien').click();
  await ownerA.page.getByRole('radio', { name: /^Central/ }).click();
  await ownerA.page.getByLabel(/^Correo de Google/).fill(invitedEmail);
  await button(ownerA.page, 'Crear invitación').click();
  await button(ownerA.page, 'Listo').click();
  await ownerA.page.getByLabel('Nombre del ayudante').fill(HELPER_A);
  await button(ownerA.page, 'Añadir').click();
  await expect(ownerA.page.getByText(`Añadimos a ${HELPER_A}.`)).toBeVisible();

  // B loads its screens again (a reload, so every list comes fresh from the server): only B.
  await dispatcherB.page.reload();
  await expect(catalogRow(dispatcherB.page, 'Balón 10 kg · Marca De B')).toBeVisible();
  await ownerB.page.reload();
  await expect(
    ownerB.page.getByRole('heading', { name: shopB.person('central').displayName }),
  ).toBeVisible();
  await expect(ownerB.page.getByText('Ninguna invitación espera.', { exact: false })).toBeVisible();
  for (const page of [ownerB.page, dispatcherB.page]) {
    await expect(page.getByText(ONLY_A)).toHaveCount(0);
    await expect(page.getByText(invitedEmail)).toHaveCount(0);
    await expect(page.getByText(HELPER_A)).toHaveCount(0);
    await expect(page.getByText(shopA.founder.displayName)).toHaveCount(0);
  }

  // B's owner points the remembered distributor of its device at A and reloads: the app
  // keeps B (the selection is a preference; membership decides).
  await ownerB.page.evaluate(
    ([uid, id]) => localStorage.setItem(`hornilla.currentDistributor.${uid}`, id),
    [shopB.founder.uid, shopA.id] as const,
  );
  await ownerB.page.goto(CATALOG_PATH);
  await expect(catalogRow(ownerB.page, 'Balón 10 kg · Marca De B')).toBeVisible();
  await expect(ownerB.page.getByText(ONLY_A)).toHaveCount(0);
  await expect(ownerB.page.getByText('Marca De A')).toHaveCount(0);

  // A visitor reads each page apart.
  const visitor = await actors.open(PHONE);
  await visitor.page.goto(`/d/${shopB.slug}`);
  const products = visitor.page.getByRole('region', { name: 'Balones y precios' });
  await expect(products.getByRole('heading', { level: 3 })).toHaveText(['Balón 10 kg']);
  await expect(visitor.page.getByText(ONLY_A)).toHaveCount(0);
  await visitor.page.goto(`/d/${shopA.slug}`);
  await expect(products.getByRole('heading', { level: 3 })).toHaveText([
    'Balón 10 kg',
    'Balón 5 kg',
  ]);
  expect(allErrors(ownerA, ownerB, dispatcherB, visitor)).toEqual([]);
});
