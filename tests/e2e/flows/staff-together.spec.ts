import { expect, type Locator, type Page } from '@playwright/test';
import {
  type Actor,
  type Actors,
  DESKTOP,
  PHONE,
  runOncePerActorDevices,
  test,
} from '../support/actors';
import { createTestAccount, readDocument, uniqueTag } from '../support/emulator-admin';
import { catalogRow, comeBackUntil } from '../support/flow-helpers';
import { type OwnDistributor, ownDistributor } from '../support/own-distributor';
import { signInAs } from '../support/sign-in';

test.skip(
  process.env.E2E_EMULATORS !== 'true',
  'Needs the seeded emulators: run with E2E_EMULATORS=true',
);
runOncePerActorDevices();
// Several people, each loading the app cold.
test.slow();

// PLAN 3.2: the staff of a distributor joins by invitation and its owner manages it, while the
// people concerned have the app open. The staff screen is not live: it is read again when the
// owner comes back to it (PLAN §11, 2026-10-15).

const STAFF_PATH = '/central/personal';
const CATALOG_PATH = '/central/catalogo';
const DENIED_NOTICE = 'Esa sección no está disponible para tu cuenta. Te llevamos a la tuya.';
const NO_INVITES = 'Ninguna invitación espera. Cada una sirve una sola vez y vence a los 7 días.';
const PRODUCTS = [{ id: 'p00', brand: 'Marca Flujo', weightKg: 10, refillPriceCents: 5000 }];
const TEN = 'Balón 10 kg · Marca Flujo';

const button = (scope: Page | Locator, name: string | RegExp, exact = false) =>
  scope.getByRole('button', { name, exact });
const heading = (page: Page) => page.getByRole('heading', { level: 1 });
const memberRow = (page: Page, name: string) =>
  page
    .getByRole('article')
    .filter({ hasText: name })
    .filter({ hasText: /acceso/ });

async function openStaff(page: Page) {
  await page.goto(STAFF_PATH);
  await expect(heading(page)).toHaveText('Tu personal.');
}

/** The owner invites from the screen; returns the path of the link it would send. */
async function invite(page: Page, role: 'Titular' | 'Central' | 'Reparto', email = '') {
  await button(page, 'Invitar a alguien').click();
  await page.getByRole('radio', { name: new RegExp(`^${role}`) }).click();
  if (email) await page.getByLabel(/^Correo de Google/).fill(email);
  await button(page, 'Crear invitación').click();
  await expect(page.getByRole('heading', { name: 'Invitación lista.' })).toBeVisible();
  const link = new URL(await page.getByLabel('Enlace de la invitación').inputValue());
  await button(page, 'Listo').click();
  return `${link.pathname}${link.hash}`;
}

async function founderOn(actors: Actors, shop: OwnDistributor) {
  const owner = await actors.open(DESKTOP);
  await signInAs(owner.page, shop.founder, '/central');
  await openStaff(owner.page);
  return owner;
}

/** What each person reads after an invitation is withdrawn and used at the same moment. */
const RACE_OUTCOMES = {
  accepted: {
    isMember: true,
    owner: 'Esa invitación ya se usó: desactiva a la persona si ya no debe entrar.',
    joiner: (name: string) => `Te uniste a ${name} como Central.`,
  },
  revoked: {
    isMember: false,
    owner: 'Invitación anulada.',
    joiner: () => 'Esta invitación fue anulada.',
  },
} as const;

const allErrors = (...people: Actor[]) => people.flatMap((person) => person.errors);

test('a person joins while the owner has the staff open: on return it is there and the invitation no longer waits', async ({
  actors,
}, testInfo) => {
  const tag = uniqueTag(testInfo);
  const shop = await ownDistributor(tag, { products: PRODUCTS });
  const owner = await founderOn(actors, shop);
  await expect(owner.page.getByText(NO_INVITES)).toBeVisible();
  const path = await invite(owner.page, 'Reparto');
  const waiting = owner.page.getByRole('article', { name: 'Invitación de Reparto' });
  await expect(waiting).toBeVisible();

  const account = await createTestAccount(`${tag}-nueva`);
  const driver = await actors.open(PHONE);
  await signInAs(driver.page, account, '/inicio');
  await driver.page.goto(path);
  await button(driver.page, `Unirme a ${shop.name}`).click();
  await expect(driver.page).toHaveURL(/\/reparto$/);
  await expect(driver.page.getByText(`Te uniste a ${shop.name} como Reparto.`)).toBeVisible();

  // The owner never reloaded: coming back to the window is enough.
  await comeBackUntil(owner.page, async () => {
    await expect(memberRow(owner.page, account.displayName)).toContainText('Con acceso', {
      timeout: 1_000,
    });
    await expect(waiting).toHaveCount(0, { timeout: 1_000 });
  });
  await expect(owner.page.getByText(NO_INVITES)).toBeVisible();
  expect(await readDocument(`distributors/${shop.id}/members/${account.uid}`)).toMatchObject({
    role: 'driver',
    active: true,
  });
  expect(allErrors(owner, driver)).toEqual([]);
});

test('a dispatcher switched off in the middle of an edit leaves its panel with the reason; switched on, it gets back in', async ({
  actors,
}, testInfo) => {
  const shop = await ownDistributor(uniqueTag(testInfo), {
    products: PRODUCTS,
    staff: [{ key: 'central', role: 'dispatcher' }],
  });
  const central = shop.person('central');
  const dispatcher = await actors.open(DESKTOP);
  await signInAs(dispatcher.page, central, '/central');
  await dispatcher.page.goto(CATALOG_PATH);
  await button(dispatcher.page, `Editar ${TEN}`).click();
  await dispatcher.page.getByLabel('Precio de la recarga (S/)').fill('61');

  const owner = await founderOn(actors, shop);
  const row = memberRow(owner.page, central.displayName);
  await button(row, `Desactivar a ${central.displayName}`).click();
  await button(owner.page, 'Sí, desactivar').click();
  await expect(
    owner.page.getByText(`${central.displayName} ya no entra a ${shop.name}.`),
  ).toBeVisible();
  await expect(row).toContainText('Sin acceso');

  // At once, without reloading: out of the panel, told why, nothing saved, nothing spinning.
  await expect(dispatcher.page).toHaveURL(/\/inicio$/);
  await expect(
    dispatcher.page.getByText(`Ya no tienes acceso a ${shop.name}`, { exact: false }),
  ).toBeVisible();
  await expect(dispatcher.page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(dispatcher.page.getByLabel('Precio de la recarga (S/)')).toHaveCount(0);
  expect((await readDocument(`distributors/${shop.id}/products/p00`))?.refillPriceCents).toBe(5000);
  // "Atrás" does not open the panel again.
  await dispatcher.page.goBack();
  await expect(dispatcher.page).toHaveURL(/\/inicio$/);
  await dispatcher.page.goto(CATALOG_PATH);
  await expect(dispatcher.page).toHaveURL(/\/inicio$/);

  // Switched back on: the next visit of the panel works.
  await button(row, `Reactivar a ${central.displayName}`).click();
  await button(owner.page, 'Sí, reactivar').click();
  await expect(
    owner.page.getByText(`${central.displayName} vuelve a entrar a ${shop.name}.`),
  ).toBeVisible();
  await expect(row).toContainText('Con acceso');
  await dispatcher.page.goto(CATALOG_PATH);
  await expect(dispatcher.page).toHaveURL(new RegExp(`${CATALOG_PATH}$`));
  await expect(catalogRow(dispatcher.page, TEN)).toContainText('S/ 50.00');
  expect(allErrors(owner, dispatcher)).toEqual([]);
});

test('the founder makes a co-owner a dispatcher while it has the staff open: it is sent to its own area and cannot invite', async ({
  actors,
}, testInfo) => {
  const shop = await ownDistributor(uniqueTag(testInfo), {
    products: PRODUCTS,
    staff: [{ key: 'socia', role: 'owner' }],
  });
  const partner = shop.person('socia');
  const coOwner = await actors.open(DESKTOP);
  await signInAs(coOwner.page, partner, '/central');
  await openStaff(coOwner.page);
  // In the middle of an invitation.
  await button(coOwner.page, 'Invitar a alguien').click();
  await coOwner.page.getByRole('radio', { name: /^Central/ }).click();

  const founder = await founderOn(actors, shop);
  const row = memberRow(founder.page, partner.displayName);
  await button(row, `Cambiar rol de ${partner.displayName}`).click();
  await row.getByRole('radio', { name: 'Central' }).click();
  await button(row, 'Guardar rol').click();
  await expect(
    founder.page.getByText(`${partner.displayName} ahora tiene el rol Central.`),
  ).toBeVisible();

  // Live: the staff screen is for owners, so it leaves it with the notice.
  await expect(coOwner.page).toHaveURL(/\/central$/);
  await expect(coOwner.page.getByText(DENIED_NOTICE)).toBeVisible();
  await expect(coOwner.page.getByRole('link', { name: 'Personal' })).toHaveCount(0);
  await expect(button(coOwner.page, 'Crear invitación')).toHaveCount(0);
  expect(await readDocument(`distributors/${shop.id}/members/${partner.uid}`)).toMatchObject({
    role: 'dispatcher',
    active: true,
  });
  expect(allErrors(founder, coOwner)).toEqual([]);
});

test('two people open the same invitation and press "Unirme" at once: one joins, the other is told it was used', async ({
  actors,
}, testInfo) => {
  const tag = uniqueTag(testInfo);
  const shop = await ownDistributor(tag, { products: PRODUCTS });
  const owner = await founderOn(actors, shop);
  const path = await invite(owner.page, 'Reparto');
  const people = await Promise.all(
    ['uno', 'dos'].map(async (key) => {
      const account = await createTestAccount(`${tag}-${key}`);
      const person = await actors.open(PHONE);
      await signInAs(person.page, account, '/inicio');
      await person.page.goto(path);
      await expect(button(person.page, `Unirme a ${shop.name}`)).toBeEnabled();
      return { account, person };
    }),
  );

  await Promise.all(
    people.map(({ person }) => button(person.page, `Unirme a ${shop.name}`).click()),
  );

  const code = path.slice(-20);
  await expect
    .poll(async () => (await readDocument(`distributors/${shop.id}/invites/${code}`))?.status)
    .toBe('accepted');
  const acceptedBy = (await readDocument(`distributors/${shop.id}/invites/${code}`))?.acceptedBy;
  const [winner, loser] =
    acceptedBy === people[0]?.account.uid ? [people[0], people[1]] : [people[1], people[0]];
  await expect(winner?.person.page ?? owner.page).toHaveURL(/\/reparto$/);
  await expect(heading(loser?.person.page ?? owner.page)).toHaveText('Esta invitación ya se usó.');
  expect(await readDocument(`distributors/${shop.id}/members/${loser?.account.uid}`)).toBeNull();
  // The owner, on return: exactly one new person.
  await comeBackUntil(owner.page, () =>
    expect(owner.page.getByText(NO_INVITES)).toBeVisible({ timeout: 1_000 }),
  );
  await expect(memberRow(owner.page, winner?.account.displayName ?? '?')).toHaveCount(1);
  await expect(memberRow(owner.page, loser?.account.displayName ?? '?')).toHaveCount(0);
  expect(allErrors(owner, ...people.map(({ person }) => person))).toEqual([]);
});

test('the owner withdraws an invitation at the moment it is used: the two screens agree with what was stored', async ({
  actors,
}, testInfo) => {
  const tag = uniqueTag(testInfo);
  const shop = await ownDistributor(tag, { products: PRODUCTS });
  const owner = await founderOn(actors, shop);
  const path = await invite(owner.page, 'Central');
  const account = await createTestAccount(`${tag}-tarde`);
  const joiner = await actors.open(DESKTOP);
  await signInAs(joiner.page, account, '/inicio');
  await joiner.page.goto(path);
  await expect(button(joiner.page, `Unirme a ${shop.name}`)).toBeEnabled();
  const row = owner.page.getByRole('article', { name: 'Invitación de Central' });
  await button(row, /^Anular/).click();

  await Promise.all([
    button(owner.page, 'Sí, anular').click(),
    button(joiner.page, `Unirme a ${shop.name}`).click(),
  ]);

  // Either may win; what each screen says must match what the database kept.
  const code = path.slice(-20);
  const statusOf = async () =>
    String((await readDocument(`distributors/${shop.id}/invites/${code}`))?.status);
  await expect.poll(statusOf).not.toBe('pending');
  const outcome = RACE_OUTCOMES[(await statusOf()) as keyof typeof RACE_OUTCOMES];
  const joined = await readDocument(`distributors/${shop.id}/members/${account.uid}`);
  expect(joined !== null).toBe(outcome.isMember);
  await expect(owner.page.getByText(outcome.owner)).toBeVisible();
  await expect(joiner.page.getByText(outcome.joiner(shop.name))).toBeVisible();
  expect(allErrors(owner, joiner)).toEqual([]);
});
