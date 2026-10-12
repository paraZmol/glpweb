import { expect, type Page, test } from '@playwright/test';
import { SEED_CUSTOMER_LOCATION, SEED_DISTRIBUTORS, SEED_USERS } from '../../seed/data';
import { deviceStorageDump, expectDeviceCleared } from '../support/device-storage';
import { signInAsSeedUser } from '../support/sign-in';
import { dismissStorageNotice } from '../support/storage-notice';

test.skip(
  process.env.E2E_EMULATORS !== 'true',
  'Needs the seeded emulators: run with E2E_EMULATORS=true',
);

const { a } = SEED_DISTRIBUTORS;
const { ownerA, customer } = SEED_USERS;

/** Every signed-in screen an account without a job can open in this phase. */
const CUSTOMER_SCREENS = ['/inicio', '/pedidos', '/cuenta'];
const OWNER_SCREENS = ['/central', ...CUSTOMER_SCREENS];

/** What would give the owner of A away on a device somebody else uses afterwards. */
const TRACES_OF_OWNER = [
  ownerA.uid,
  ownerA.email,
  ownerA.displayName,
  ownerA.phone,
  a.id,
  a.name,
  String(SEED_CUSTOMER_LOCATION.lat),
];
const TRACES_OF_CUSTOMER = [customer.uid, customer.email, customer.displayName, customer.phone];

/** The text of `path` once its content is on screen (never the skeleton of the area). */
async function screenText(page: Page, path: string): Promise<string> {
  await page.goto(path);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
  return page.locator('body').innerText();
}

async function signOutFromAccount(page: Page) {
  await page.goto('/cuenta');
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('banner').getByRole('link', { name: 'Ingresar' })).toBeVisible();
  await expectDeviceCleared(page);
}

// Many full loads of the app in each flow: the default budget is for a single screen.
test.slow();

test.beforeEach(async ({ context }) => {
  await dismissStorageNotice(context);
});

// PLAN 2.9: a shared device. Whoever signs in next finds nothing of the previous account.
test('a customer who signs in after the owner of A finds nothing of that account', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({
    latitude: SEED_CUSTOMER_LOCATION.lat,
    longitude: SEED_CUSTOMER_LOCATION.lng,
  });
  await signInAsSeedUser(page, 'ownerA');
  await expect(page.getByRole('heading', { level: 1 })).toContainText(a.name);
  // The owner also leaves a searched location and a saved profile screen behind.
  await page.goto('/inicio');
  await page.getByRole('button', { name: 'Usar mi ubicación' }).click();
  await expect(page.getByRole('article')).toHaveCount(2);
  expect(await screenText(page, '/cuenta')).toContain(ownerA.email);
  expect(await deviceStorageDump(page)).toContain(a.id);

  await signOutFromAccount(page);
  await signInAsSeedUser(page, 'customer');

  for (const path of CUSTOMER_SCREENS) {
    const text = await screenText(page, path);
    for (const trace of TRACES_OF_OWNER)
      expect.soft(text, `${path} shows ${trace}`).not.toContain(trace);
  }
  // The location the owner searched from is forgotten: the finder asks again.
  await page.goto('/inicio');
  await expect(
    page.getByRole('heading', { name: 'Dinos dónde y vemos quién llega.' }),
  ).toBeVisible();
  const stored = await deviceStorageDump(page);
  for (const trace of TRACES_OF_OWNER)
    expect.soft(stored, `storage keeps ${trace}`).not.toContain(trace);
  // The customer cannot walk into the office the owner left open either.
  await page.goto('/central');
  await expect(page).toHaveURL(/\/inicio$/);
});

test('the owner of A who signs in after a customer finds nothing of that account', async ({
  page,
}) => {
  await signInAsSeedUser(page, 'customer');
  expect(await screenText(page, '/cuenta')).toContain(customer.email);
  expect(await deviceStorageDump(page)).toContain(customer.displayName);

  await signOutFromAccount(page);
  await signInAsSeedUser(page, 'ownerA');

  for (const path of OWNER_SCREENS) {
    const text = await screenText(page, path);
    for (const trace of TRACES_OF_CUSTOMER)
      expect.soft(text, `${path} shows ${trace}`).not.toContain(trace);
  }
  const stored = await deviceStorageDump(page);
  for (const trace of TRACES_OF_CUSTOMER)
    expect.soft(stored, `storage keeps ${trace}`).not.toContain(trace);
});
