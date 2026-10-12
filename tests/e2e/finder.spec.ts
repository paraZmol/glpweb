import { expect, test } from '@playwright/test';
import { SEED_CUSTOMER_LOCATION, SEED_DISTRIBUTORS } from '../seed/data';
import { dismissStorageNotice } from './support/storage-notice';

test.skip(
  process.env.E2E_EMULATORS !== 'true',
  'Needs the seeded emulators: run with E2E_EMULATORS=true',
);

/** Far from every seeded plant (and from the ones other tests found). */
const NOBODY_DELIVERS_HERE = { latitude: -15.5, longitude: -70.1 };
const { a, b, c, d } = SEED_DISTRIBUTORS;

test.beforeEach(async ({ page }) => {
  await dismissStorageNotice(page);
});

// PLAN 2.6: who covers my point, nearest first, and the way to each page.
test('lists the distributors that cover the device location, nearest first', async ({
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

  await expect(page.getByRole('heading', { name: 'Llegan a tu punto' })).toBeVisible();
  const cards = page.getByRole('article');
  await expect(cards).toHaveCount(2);
  await expect(cards.nth(0)).toContainText(a.name);
  await expect(cards.nth(0)).toContainText('a 1,1 km de tu punto');
  await expect(cards.nth(0)).toContainText('S/ 38.00');
  await expect(cards.nth(1)).toContainText(b.name);
  // Outside their radius, suspended or with the trial over: they do not show.
  await expect(page.getByText(c.name)).toHaveCount(0);
  await expect(page.getByText(d.name)).toHaveCount(0);

  await page.getByRole('link', { name: `Ver distribuidora ${b.name}` }).click();
  await expect(page).toHaveURL(new RegExp(`/d/${b.slug}$`));
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(b.name);
});

test('remembers the location on the device for the next visit', async ({ page, context }) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({
    latitude: SEED_CUSTOMER_LOCATION.lat,
    longitude: SEED_CUSTOMER_LOCATION.lng,
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Usar mi ubicación' }).click();
  await expect(page.getByRole('article')).toHaveCount(2);

  await page.reload();

  await expect(page.getByRole('article')).toHaveCount(2);
  await expect(page.getByRole('region', { name: 'Dónde entregar' })).toContainText('-12.0500');
});

test('says that nobody delivers to a point outside every coverage', async ({ page, context }) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation(NOBODY_DELIVERS_HERE);
  await page.goto('/');

  await page.getByRole('button', { name: 'Usar mi ubicación' }).click();

  await expect(
    page.getByRole('heading', { name: 'Todavía no hay distribuidoras en tu zona.' }),
  ).toBeVisible();
  await expect(page.getByRole('article')).toHaveCount(0);
  await expect(page.getByRole('link', { name: /Avisarle por WhatsApp/ })).toHaveAttribute(
    'href',
    /^https:\/\/wa\.me\/\?text=/,
  );
});

// The permission is asked only after the tap, and refusing it is not a dead end.
test('works with the location permission denied: the point can be typed by hand', async ({
  page,
}) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'Usar mi ubicación' }).click();

  await expect(page.getByText(/No tenemos permiso para ver tu ubicación/)).toBeVisible();
  await page
    .getByLabel('Coordenadas del punto')
    .fill(`${SEED_CUSTOMER_LOCATION.lat}, ${SEED_CUSTOMER_LOCATION.lng}`);
  await page.getByRole('button', { name: 'Buscar aquí' }).click();

  await expect(page.getByRole('article')).toHaveCount(2);
  await expect(page.getByRole('region', { name: 'Dónde entregar' })).toContainText(
    'El punto que escribiste',
  );
});

test('refuses text that holds no coordinates, and says how they look', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Escribir las coordenadas' }).click();

  await page.getByLabel('Coordenadas del punto').fill('Jr. Los Cedros 245');
  await page.getByRole('button', { name: 'Buscar aquí' }).click();

  await expect(page.getByText(/No reconocimos esas coordenadas/)).toBeVisible();
  await expect(page.getByRole('article')).toHaveCount(0);
});
