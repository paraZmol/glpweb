// Quality (testing-strategy §7, CLAUDE.md "free quota"): documents Firestore sends to the page
// when each screen opens, while it stays open, and when the person comes back to it. The count
// is what the quota bills (tests/e2e/support/firestore-reads.ts). Every screen opens in a cold
// context (empty local cache), the worst case of a first visit. It runs once, under the desktop
// project: the phone asks for the same documents.
import { expect, type Page, test } from '@playwright/test';
import { reportMeasure } from '../support/measure';
import { SEED_USERS } from '../../seed/data';
import { comeBack } from '../support/flow-helpers';
import { countFirestoreReads } from '../support/firestore-reads';
import { signInAs } from '../support/sign-in';
import { dismissStorageNotice } from '../support/storage-notice';

test.skip(
  process.env.E2E_EMULATORS !== 'true',
  'Needs the seeded emulators: run with E2E_EMULATORS=true',
);
test.skip(({ isMobile }) => isMobile, 'The phone asks for the same documents: it runs once');

/** How long a screen is left open and untouched, and the pauses around the two returns. */
const OBSERVATION_MS = 10_000;
const RETURN_GAP_MS = 1_200;
const RETURN_SETTLE_MS = 3_000;

/** Documents a screen may read when it opens (query limits of src/data + 1 of the rules). */
const SCREENS = [
  { path: '/central/stock', ready: /Stock de planta/, opens: 60, costly: true },
  { path: '/central/promociones', ready: /promociones/i, opens: 30, costly: false },
  { path: '/central/vehiculos', ready: /vehículos/i, opens: 30, costly: false },
] as const;

/** Opens the page with the session of the seeded owner, in a context that has nothing cached. */
async function openCold(browser: import('@playwright/test').Browser, path: string) {
  const signedIn = await browser.newContext();
  await dismissStorageNotice(signedIn);
  await signInAs(await signedIn.newPage(), SEED_USERS.ownerA, '/central');
  const state = await signedIn.storageState({ indexedDB: true });
  await signedIn.close();
  const context = await browser.newContext({ storageState: state });
  const page: Page = await context.newPage();
  const reads = await countFirestoreReads(page);
  await page.goto(path);
  return { context, page, reads };
}

for (const screen of SCREENS) {
  test(`${screen.path}: reads on opening, while open and on coming back`, async ({
    browser,
  }, testInfo) => {
    const { context, page, reads } = await openCold(browser, screen.path);
    await expect(page.getByRole('heading', { level: 1, name: screen.ready })).toBeVisible();
    const onOpen = await reads.total();

    // Left open and untouched: nothing may keep reading (no listener on a collection).
    // A window of observation, not a wait for a state: what matters is that nothing arrives.
    await page.waitForTimeout(OBSERVATION_MS);
    const whileOpen = (await reads.total()) - onOpen;

    // One return, then another one a moment later (a person switching windows).
    const beforeReturns = await reads.total();
    await comeBack(page);
    await page.waitForTimeout(RETURN_SETTLE_MS);
    const firstReturn = (await reads.total()) - beforeReturns;
    await page.waitForTimeout(RETURN_GAP_MS);
    await comeBack(page);
    await page.waitForTimeout(RETURN_SETTLE_MS);
    const secondReturn = (await reads.total()) - beforeReturns - firstReturn;
    reportMeasure(
      testInfo,
      'reads',
      `${screen.path}: ${onOpen} on opening, ${whileOpen} in 10 s open, ${firstReturn} on a return, ${secondReturn} on a second one 1.2 s later`,
    );
    expect(onOpen).toBeLessThanOrEqual(screen.opens);
    expect(whileOpen).toBe(0);
    if (screen.costly) expect(secondReturn, 'a costly list waits before loading again').toBe(0);
    await context.close();
  });
}

const PUBLIC_SCREENS = [
  { path: '/', ready: /Pide tu gas/, opens: 0 },
  { path: '/d/gas-demo-norte', ready: /Gas Demo Norte/, opens: 30 },
] as const;

for (const screen of PUBLIC_SCREENS) {
  test(`${screen.path}: reads of a visitor without a session`, async ({ browser }, testInfo) => {
    const context = await browser.newContext();
    await dismissStorageNotice(context);
    const page = await context.newPage();
    const reads = await countFirestoreReads(page);
    await page.goto(screen.path);
    await expect(page.getByRole('heading', { level: 1, name: screen.ready })).toBeVisible();
    await page.waitForTimeout(RETURN_SETTLE_MS);
    const onOpen = await reads.total();
    await page.waitForTimeout(OBSERVATION_MS);
    const whileOpen = (await reads.total()) - onOpen;
    reportMeasure(
      testInfo,
      'reads',
      `${screen.path}: ${onOpen} on opening, ${whileOpen} in 10 s open`,
    );
    expect(onOpen).toBeLessThanOrEqual(screen.opens);
    expect(whileOpen).toBe(0);
    await context.close();
  });
}
