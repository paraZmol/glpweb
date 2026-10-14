import { expect, type Page, test } from '@playwright/test';
import { dismissStorageNotice } from './support/storage-notice';

test.skip(
  process.env.E2E_EMULATORS !== 'true',
  'Needs the seeded emulators: run with E2E_EMULATORS=true',
);

/** Google's script loader and the sign-in frame of the real service. */
const GOOGLE = /^https:\/\/(apis\.google\.com|[^/]+\.firebaseapp\.com)\//;

/** The frame Firebase Auth embeds to talk to Google: the real one or the emulator's. */
const authFrames = (page: Page) =>
  page
    .frames()
    .map((frame) => frame.url())
    .filter((url) => /\/(__|emulator)\/auth\/iframe/.test(url));

// PLAN §11 (2026-10-14), legal review: on phones and in Safari the SDK used to prepare Google's
// sign-in frame as soon as the app opened, so every visitor contacted Google. Now nothing goes
// to Google until the person presses "Continuar con Google". Phones only: that is where the SDK
// did it (Safari, the other case, has no engine in this suite).
test('nobody contacts Google before "Continuar con Google" is pressed, on a phone', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'movil', 'The SDK prepared the frame on phones and Safari');
  await dismissStorageNotice(page);
  const toGoogle: string[] = [];
  // Recorded and cut short: the test needs no internet.
  await page.context().route(GOOGLE, async (route) => {
    toGoogle.push(route.request().url());
    await route.abort();
  });

  await page.goto('/');
  // The session is known: Firebase Auth finished starting, the moment it used to reach Google.
  const enter = page.getByRole('banner').getByRole('link', { name: 'Ingresar' });
  await expect(enter).toBeVisible();
  await enter.click();
  const button = page.getByRole('button', { name: 'Continuar con Google' });
  await expect(button).toBeEnabled();

  expect(toGoogle).toEqual([]);
  expect(authFrames(page)).toEqual([]);

  await button.click();

  // Pressing it is what reaches Google, which shows the check above can see it.
  await expect.poll(() => toGoogle.length).toBeGreaterThan(0);
});
