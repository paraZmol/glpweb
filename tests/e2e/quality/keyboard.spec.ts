// Quality (testing-strategy §7, perf-a11y-auditor): a whole screen used only with the keyboard.
// Every stop of Tab has a name and a visible focus ring, the first stop is the skip link, the
// focus never gets trapped, and the phone menu closes with Escape and gives the focus back.
// The screens of the plant need the seeded emulators; the public ones do not.
import { expect, type Page, test } from '@playwright/test';
import { SEED_USERS } from '../../seed/data';
import { walkWithTab } from '../support/keyboard-walk';
import { signInAs } from '../support/sign-in';
import { dismissStorageNotice } from '../support/storage-notice';

const withEmulators = process.env.E2E_EMULATORS === 'true';

const PUBLIC_SCREENS = ['/', '/para-distribuidoras', '/d/gas-demo-norte'] as const;
const PLANT_SCREENS = ['/central/stock', '/central/promociones', '/central/vehiculos'] as const;

async function expectKeyboardFriendly(page: Page) {
  const { stops, looped } = await walkWithTab(page);
  expect(stops.length, 'the screen has something to reach').toBeGreaterThan(2);
  expect(stops[0]?.name, 'the first stop of Tab').toBe('Saltar al contenido');
  expect(looped, 'the focus must leave the page, not circle inside it').toBe(false);
  expect(
    stops.filter((stop) => stop.name === ''),
    'stops without a name',
  ).toEqual([]);
  expect(
    stops.filter((stop) => !stop.hasFocusRing).map((stop) => `${stop.tag} ${stop.name}`),
    'stops without a visible focus ring',
  ).toEqual([]);
}

test.describe('public screens', () => {
  test.skip(
    !withEmulators,
    'The visitor page reads the seeded emulators: run with E2E_EMULATORS=true',
  );

  for (const path of PUBLIC_SCREENS) {
    test(`${path}: Tab reaches everything with a name and a visible focus ring`, async ({
      page,
    }) => {
      await dismissStorageNotice(page);
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expectKeyboardFriendly(page);
    });
  }

  test('the skip link takes the focus to the content', async ({ page }) => {
    await dismissStorageNotice(page);
    await page.goto('/');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Saltar al contenido' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#contenido$/);
  });
});

test.describe('screens of the plant', () => {
  test.skip(!withEmulators, 'Needs the seeded emulators: run with E2E_EMULATORS=true');
  test.skip(
    ({ isMobile }) => isMobile,
    'Same screens as on desktop; the phone bar is walked too below',
  );

  for (const path of PLANT_SCREENS) {
    test(`${path}: Tab reaches everything with a name and a visible focus ring`, async ({
      page,
    }) => {
      await dismissStorageNotice(page);
      await signInAs(page, SEED_USERS.ownerA, '/central');
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expectKeyboardFriendly(page);
    });
  }
});

test.describe('phone menu of the public pages', () => {
  test.skip(({ isMobile }) => !isMobile, 'The menu button only exists on the phone');

  test('opens from the keyboard, keeps the focus inside and Escape gives it back', async ({
    page,
  }) => {
    await dismissStorageNotice(page);
    await page.goto('/');
    const toggle = page.getByRole('button', { name: 'Abrir menú' });
    await toggle.focus();
    await page.keyboard.press('Enter');
    const menu = page.getByRole('navigation', { name: 'Menú principal' });
    await expect(menu).toBeVisible();
    // Tab never leaves the panel and the button: it goes round.
    for (let step = 0; step < 12; step += 1) {
      await page.keyboard.press('Tab');
      const inside = await page.evaluate(() => {
        const active = document.activeElement;
        return Boolean(active?.closest('#menu-publico') || active?.getAttribute('aria-controls'));
      });
      expect(inside, `Tab ${step + 1} stays in the menu`).toBe(true);
    }
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(page.getByRole('button', { name: 'Abrir menú' })).toBeFocused();
  });
});
