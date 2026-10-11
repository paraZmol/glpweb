import { type BrowserContext, expect, type Page, test } from '@playwright/test';
import { SEED_CUSTOMER_LOCATION, SEED_DISTRIBUTORS } from '../../seed/data';
import { appStorageKeys, expectDeviceCleared } from '../support/device-storage';
import { createTestAccount, readDocument, uniqueTag } from '../support/emulator-admin';
import { signInWithPassword } from '../support/sign-in';
import { dismissStorageNotice } from '../support/storage-notice';

test.skip(
  process.env.E2E_EMULATORS !== 'true',
  'Needs the seeded emulators: run with E2E_EMULATORS=true',
);

const OFFLINE_BANNER = 'Sin conexión. Mostrando lo último que se guardó.';
const SAVE_NEEDS_INTERNET = 'Sin conexión: para guardar los cambios necesitas internet.';
const UNSENT_WARNING = /Hay cambios que todavía no se enviaron porque no hay conexión/;
// Plain writes travel on the Write stream; a transaction (how the profile is saved since PLAN
// 2.11) reads with `:batchGet` and writes with `:commit`.
const FIRESTORE_WRITES = /google\.firestore\.v1\.Firestore\/Write\/|documents:(batchGet|commit)/;
const NEW_NAME = 'X. Cambiada';
const { a, b } = SEED_DISTRIBUTORS;

const nameField = (page: Page) => page.getByLabel('Nombre', { exact: true });
const saveButton = (page: Page) => page.getByRole('button', { name: 'Guardar cambios' });

/**
 * The connection drops at the worst moment: the next write to the database leaves the screen
 * and never arrives. From then on no write gets through, also if the device reports a
 * connection again (`context.setOffline(false)`), so the change stays unsent.
 */
async function loseConnectionOnNextWrite(context: BrowserContext) {
  let isLost = false;
  await context.route(FIRESTORE_WRITES, async (route) => {
    if (!isLost) {
      isLost = true;
      await context.setOffline(true);
    }
    await route.abort('internetdisconnected');
  });
}

test.beforeEach(async ({ context }) => {
  await dismissStorageNotice(context);
});

// PLAN 2.6: the connection drops with the list of distributors on screen.
test('the finder keeps its results when the connection drops, and says so', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({
    latitude: SEED_CUSTOMER_LOCATION.lat,
    longitude: SEED_CUSTOMER_LOCATION.lng,
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Usar mi ubicación' }).click();
  await expect(page.getByRole('article')).toHaveCount(2);

  await context.setOffline(true);

  await expect(page.getByText(OFFLINE_BANNER)).toBeVisible();
  const cards = page.getByRole('article');
  await expect(cards).toHaveCount(2);
  await expect(cards.nth(0)).toContainText(a.name);
  await expect(cards.nth(1)).toContainText(b.name);

  await context.setOffline(false);

  await expect(page.getByText(OFFLINE_BANNER)).toHaveCount(0);
  await expect(cards).toHaveCount(2);
});

// PLAN 2.1: saving the profile without a connection explains itself instead of spinning.
test('the account screen says why it cannot save without a connection', async ({
  page,
  context,
}, testInfo) => {
  const account = await createTestAccount(uniqueTag(testInfo));
  await signInWithPassword(page, account.email, '/inicio');
  await page.goto('/cuenta');
  await expect(nameField(page)).toHaveValue(account.displayName);

  await context.setOffline(true);
  await nameField(page).fill(NEW_NAME);

  await expect(page.getByText(OFFLINE_BANNER)).toBeVisible();
  await expect(page.getByText(SAVE_NEEDS_INTERNET)).toBeVisible();
  await expect(saveButton(page)).toBeDisabled();
  // What was typed waits on screen; with the connection back it is saved.
  await context.setOffline(false);
  await expect(page.getByText(SAVE_NEEDS_INTERNET)).toHaveCount(0);
  await expect(nameField(page)).toHaveValue(NEW_NAME);
  await saveButton(page).click();
  await expect(page.getByText('Guardamos tus datos.')).toBeVisible();
  expect(await readDocument(`users/${account.uid}`)).toMatchObject({ displayName: NEW_NAME });
});

// PLAN 2.1 ("debe avisar, no quedarse pensando"). Defect reported by flow-tester on 2026-10-10
// and fixed on 2026-10-11: the connection drops AFTER pressing "Guardar cambios" (the device
// still said "online" when the button was pressed). `saveProfile` now has a deadline: the
// button stops spinning, and nothing stays queued to be sent behind the person's back.
test('a save cut by a lost connection tells the person instead of spinning for ever', async ({
  page,
  context,
}, testInfo) => {
  const account = await createTestAccount(uniqueTag(testInfo));
  await signInWithPassword(page, account.email, '/inicio');
  await page.goto('/cuenta');
  await expect(nameField(page)).toHaveValue(account.displayName);
  await loseConnectionOnNextWrite(context);

  await nameField(page).fill(NEW_NAME);
  await saveButton(page).click();

  await expect(page.getByText(OFFLINE_BANNER)).toBeVisible();
  await expect(page.getByText(SAVE_NEEDS_INTERNET)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Guardando…' })).toHaveCount(0);
  // The change was not saved, and it is not waiting to be sent either: with the connection
  // back and the page still open, the server keeps the old name.
  await context.unroute(FIRESTORE_WRITES);
  await context.setOffline(false);
  await expect(page.getByText(OFFLINE_BANNER)).toHaveCount(0);
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(page).toHaveURL(/\/$/);
  expect(await readDocument(`users/${account.uid}`)).toMatchObject({
    displayName: account.displayName,
  });
});

// PLAN 2.9: signing out with a change that never reached the server warns before losing it.
// FIXME 2026-10-11 — this flow can no longer be produced from a screen: it relied on the profile
// form leaving its write queued when the connection dropped, and since PLAN 2.11 `saveProfile`
// never queues (the test above). The warning itself is still there (`endSession` asks
// `hasUnsentWrites`) for the writes that will be queued on purpose; bring this flow back with
// the first screen that has one (addresses, PLAN 4.1) and remove the `fixme`.
test.fixme('signing out with an unsent change warns first and offers to sign out anyway', async ({
  page,
  context,
}, testInfo) => {
  const account = await createTestAccount(uniqueTag(testInfo));
  await signInWithPassword(page, account.email, '/inicio');
  await page.goto('/cuenta');
  await expect(nameField(page)).toHaveValue(account.displayName);
  await loseConnectionOnNextWrite(context);
  await nameField(page).fill(NEW_NAME);
  await saveButton(page).click();
  await expect(page.getByText(OFFLINE_BANNER)).toBeVisible();

  await page.getByRole('button', { name: 'Cerrar sesión' }).click();

  // Nothing is lost yet: the warning says what is about to happen and waits for the person.
  await expect(page.getByText(UNSENT_WARNING)).toBeVisible();
  await expect(page).toHaveURL(/\/cuenta$/);
  expect(await appStorageKeys(page)).toContain('hornilla.localData');

  // The page needs the network to come back up after signing out; the change stays unsent.
  await context.setOffline(false);
  await page.getByRole('button', { name: 'Cerrar sesión igual' }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('banner').getByRole('link', { name: 'Ingresar' })).toBeVisible();
  await expectDeviceCleared(page);
  // As the warning said, the change was lost: the server keeps the old name.
  expect(await readDocument(`users/${account.uid}`)).toMatchObject({
    displayName: account.displayName,
  });
});
