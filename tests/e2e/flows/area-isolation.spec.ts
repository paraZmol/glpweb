import { expect, type Page } from '@playwright/test';
import { SEED_DISTRIBUTORS, SEED_USERS } from '../../seed/data';
import { DESKTOP, runOncePerActorDevices, test } from '../support/actors';
import { deviceStorageDump } from '../support/device-storage';
import { SEED_HOME_PATH, type SeedUserKey, submitSignIn } from '../support/sign-in';

test.skip(
  process.env.E2E_EMULATORS !== 'true',
  'Needs the seeded emulators: run with E2E_EMULATORS=true',
);
runOncePerActorDevices();
// Every actor opens a context of its own, which loads the app cold (nothing cached): with
// all the workers doing the same, two actors do not fit in the budget of one screen.
test.slow();

const DENIED_NOTICE = 'Esa sección no está disponible para tu cuenta. Te llevamos a la tuya.';
const { a, b } = SEED_DISTRIBUTORS;
const { ownerB, dispatcherB, driverB } = SEED_USERS;

const heading = (page: Page) => page.getByRole('heading', { level: 1 });

// PLAN 2.4 and the criterion of phase 2: nobody opens an area that is not theirs by typing its
// address. Each account lands on its own area and is told why.
const FOREIGN_AREAS: [SeedUserKey, string][] = [
  ['ownerB', '/reparto'],
  ['ownerB', '/plataforma'],
  ['dispatcherA', '/reparto'],
  ['dispatcherA', '/plataforma'],
  ['driverA', '/central'],
  ['driverA', '/plataforma'],
  ['customer', '/central'],
  ['customer', '/reparto'],
  ['customer', '/plataforma'],
  ['admin', '/central'],
  ['admin', '/reparto'],
];

for (const [key, path] of FOREIGN_AREAS) {
  test(`${key} typing ${path} lands on its own area with a notice`, async ({ actors }) => {
    const { page, errors } = await actors.openSeed(key);

    await page.goto(path);

    await expect(page).toHaveURL(new RegExp(`${SEED_HOME_PATH[key]}$`));
    await expect(page.getByText(DENIED_NOTICE)).toBeVisible();
    await expect(heading(page)).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test('the platform admin opens the platform panel, and nobody else is offered it', async ({
  actors,
}) => {
  const admin = await actors.openSeed('admin');
  const owner = await actors.openSeed('ownerA');

  await admin.page.goto('/plataforma');
  await owner.page.goto('/cuenta');

  await expect(admin.page).toHaveURL(/\/plataforma$/);
  await expect(heading(admin.page)).toHaveText('Altas pendientes.');
  await expect(admin.page.getByText(DENIED_NOTICE)).toHaveCount(0);
  await expect(heading(owner.page)).toHaveText('Tu cuenta.');
  await expect(owner.page.getByRole('link', { name: 'Abrir Central' })).toBeVisible();
  await expect(owner.page.getByRole('link', { name: /Plataforma/ })).toHaveCount(0);
  expect([...admin.errors, ...owner.errors]).toEqual([]);
});

test('a visitor typing /central signs in first and is still kept out of it', async ({ actors }) => {
  const { page, errors } = await actors.open(DESKTOP);

  await page.goto('/central');

  await expect(page).toHaveURL(/\/ingresar\?desde=%2Fcentral$/);
  await expect(page.getByText('Ingresa para continuar.')).toBeVisible();
  await submitSignIn(page, SEED_USERS.customer.email);
  await expect(page).toHaveURL(/\/inicio$/);
  await expect(page.getByText(DENIED_NOTICE)).toBeVisible();
  expect(errors).toEqual([]);
});

// Flow 5 of testing-strategy §3: the owner of A sees nothing of B on any screen or by URL.
test('the owners of A and B work at the same time and each sees only their own', async ({
  actors,
}) => {
  const ownerOfA = await actors.openSeed('ownerA');
  const ownerOfB = await actors.openSeed('ownerB');
  const tracesOfB = [b.id, b.name, b.slug, ownerB.displayName, dispatcherB.uid, driverB.uid];

  await expect(heading(ownerOfA.page)).toHaveText(`Hoy en ${a.name}.`);
  await expect(heading(ownerOfB.page)).toHaveText(`Hoy en ${b.name}.`);
  // Exact: the listing status above also shows the link, as a whole address (PLAN 2.11).
  await expect(ownerOfA.page.getByText(`/d/${a.slug}`, { exact: true })).toBeVisible();
  await expect(ownerOfB.page.getByText(`/d/${b.slug}`, { exact: true })).toBeVisible();
  await expect(ownerOfA.page.getByLabel('Cambiar de distribuidora')).toHaveCount(0);
  for (const path of ['/central', '/cuenta', '/pedidos', '/inicio']) {
    await ownerOfA.page.goto(path);
    await expect(heading(ownerOfA.page)).toBeVisible();
    await expect(ownerOfA.page.locator('[aria-busy="true"]')).toHaveCount(0);
    await expect(ownerOfA.page.getByText(b.name)).toHaveCount(0);
  }
  const stored = await deviceStorageDump(ownerOfA.page);
  for (const trace of tracesOfB)
    expect.soft(stored, `storage of A keeps ${trace}`).not.toContain(trace);

  // The owner of A points the remembered distributor at B by hand and reloads.
  await ownerOfA.page.evaluate(
    ([uid, distributorId]) =>
      localStorage.setItem(`hornilla.currentDistributor.${uid}`, distributorId),
    [ownerOfA.user.uid, b.id] as const,
  );
  await ownerOfA.page.goto('/central');

  await expect(heading(ownerOfA.page)).toHaveText(`Hoy en ${a.name}.`);
  await expect(ownerOfA.page.getByText(b.name)).toHaveCount(0);
  // Meanwhile nothing moved for the owner of B, who never reloaded.
  await expect(heading(ownerOfB.page)).toHaveText(`Hoy en ${b.name}.`);
  expect([...ownerOfA.errors, ...ownerOfB.errors]).toEqual([]);
});
