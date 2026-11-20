// Quality (testing-strategy §7): how much JavaScript each route downloads, and that Firebase
// and every role area stay out of the first load of the home. Weight is the gzip of what a
// cold browser fetched until the screen was ready. It runs once, under the desktop project:
// the phone downloads the same files.
import { expect, test } from '@playwright/test';
import { reportMeasure } from '../support/measure';
import { SEED_USERS } from '../../seed/data';
import { signInAs } from '../support/sign-in';
import { dismissStorageNotice } from '../support/storage-notice';
import { chunkName, firstLoadHrefs, totalKb, trackScripts } from '../support/script-weight';

test.skip(
  process.env.E2E_EMULATORS !== 'true',
  'Needs the seeded emulators: run with E2E_EMULATORS=true',
);
test.skip(({ isMobile }) => isMobile, 'The files are the same on the phone: it runs once');

/** testing-strategy §7: JavaScript of the first load of the public page, in KB of gzip. */
const FIRST_LOAD_BUDGET_KB = 200;
/** A screen of an area: its area, the shared code and Firebase (today about 470 KB). */
const ROUTE_BUDGET_KB = 520;

test('home: the first load is within budget and leaves Firebase and the role areas apart', async ({
  browser,
}, testInfo) => {
  const context = await browser.newContext();
  await dismissStorageNotice(context);
  const page = await context.newPage();
  const scripts = trackScripts(page);
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('button', { name: 'Usar mi ubicación' })).toBeVisible();
  const hrefs = await firstLoadHrefs(page);
  // The header asks Firebase who is here: when the entry link shows, that chunk has arrived.
  await expect(page.getByRole('link', { name: 'Ingresar' }).first()).toBeVisible();
  const fetched = await scripts.settle();
  const first = fetched.filter((script) => hrefs.some((href) => href.endsWith(script.file)));
  const later = fetched.filter((script) => !first.includes(script));
  const line = (files: typeof fetched) =>
    files.map((file) => `${chunkName(file.file)} ${file.kb.toFixed(1)}`).join(', ');
  reportMeasure(
    testInfo,
    'weight',
    `first load ${totalKb(first).toFixed(1)} KB (${line(first)}); later ${totalKb(later).toFixed(1)} KB (${line(later)})`,
  );
  expect(totalKb(first)).toBeLessThanOrEqual(FIRST_LOAD_BUDGET_KB);
  const names = first.map((script) => chunkName(script.file));
  for (const heavy of ['firebase', 'office', 'driver', 'customer', 'platform', 'account']) {
    expect(names, `${heavy} must load apart`).not.toContain(heavy);
  }
  await context.close();
});

const ROUTES_OF_THE_PLANT = [
  { path: '/central/stock', ready: 'Stock de planta' },
  { path: '/central/promociones', ready: 'Promociones' },
  { path: '/central/vehiculos', ready: 'Vehículos' },
] as const;

for (const route of ROUTES_OF_THE_PLANT) {
  test(`${route.path}: weight of the route is reported and bounded`, async ({
    browser,
  }, testInfo) => {
    // The session is opened in one context and carried to a cold one: nothing is cached there.
    const signedIn = await browser.newContext();
    await dismissStorageNotice(signedIn);
    await signInAs(await signedIn.newPage(), SEED_USERS.ownerA, '/central');
    const state = await signedIn.storageState({ indexedDB: true });
    await signedIn.close();
    const context = await browser.newContext({ storageState: state });
    const page = await context.newPage();
    const scripts = trackScripts(page);
    await page.goto(route.path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const fetched = await scripts.settle();
    reportMeasure(
      testInfo,
      'weight',
      `${route.path}: ${totalKb(fetched).toFixed(1)} KB gzip (${fetched
        .map((file) => `${chunkName(file.file)} ${file.kb.toFixed(1)}`)
        .join(', ')})`,
    );
    expect(totalKb(fetched)).toBeLessThanOrEqual(ROUTE_BUDGET_KB);
    await context.close();
  });
}
