// Quality (testing-strategy §7, perf-a11y-auditor): text at 200 %, 360 px and reduced motion.
// - Text zoom: the root font size doubles (what "text only" zoom does on a phone); nothing may
//   scroll sideways and the main action must still be reachable.
// - 360 px: the narrowest phone still in use never scrolls sideways.
// - Reduced motion: on the screens of the plant nothing keeps animating a transform.
import { expect, type Page, test } from '@playwright/test';
import { SEED_USERS } from '../../seed/data';
import { signInAs } from '../support/sign-in';
import { dismissStorageNotice } from '../support/storage-notice';

test.skip(
  process.env.E2E_EMULATORS !== 'true',
  'The pages read the seeded emulators: run with E2E_EMULATORS=true',
);

const PUBLIC_SCREENS = [
  { path: '/', action: 'Usar mi ubicación' },
  { path: '/para-distribuidoras', action: 'Registrar mi distribuidora' },
  { path: '/d/gas-demo-norte', action: null },
] as const;
const PLANT_SCREENS = ['/central/stock', '/central/promociones', '/central/vehiculos'] as const;

/** How many pixels the page can be scrolled sideways. */
const sidewaysOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test.describe('text at 200 %', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  for (const screen of PUBLIC_SCREENS) {
    test(`${screen.path}: nothing scrolls sideways and the main action is there`, async ({
      page,
    }) => {
      await dismissStorageNotice(page);
      await page.goto(screen.path);
      await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      expect(await sidewaysOverflow(page)).toBeLessThanOrEqual(0);
      if (screen.action) {
        await expect(
          page
            .getByRole('button', { name: screen.action })
            .or(page.getByRole('link', { name: screen.action }))
            .first(),
        ).toBeVisible();
      }
    });
  }
});

test.describe('360 px wide', () => {
  test.use({ viewport: { width: 360, height: 740 } });

  for (const screen of PUBLIC_SCREENS) {
    test(`${screen.path}: no sideways scroll`, async ({ page }) => {
      await dismissStorageNotice(page);
      await page.goto(screen.path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      expect(await sidewaysOverflow(page)).toBeLessThanOrEqual(0);
    });
  }

  for (const path of PLANT_SCREENS) {
    test(`${path}: no sideways scroll`, async ({ page }) => {
      await dismissStorageNotice(page);
      await signInAs(page, SEED_USERS.ownerA, '/central');
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      expect(await sidewaysOverflow(page)).toBeLessThanOrEqual(0);
    });
  }
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  for (const path of PLANT_SCREENS) {
    test(`${path}: complete and still, nothing displaced`, async ({ page }) => {
      await dismissStorageNotice(page);
      await signInAs(page, SEED_USERS.ownerA, '/central');
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page.getByRole('list').first()).toBeVisible();
      const moving = await page.locator('main').evaluate((main) =>
        [...main.querySelectorAll<HTMLElement>('*')]
          .filter((element) => {
            const style = getComputedStyle(element);
            const isIdentity = ['none', 'matrix(1, 0, 0, 1, 0, 0)'].includes(style.transform);
            return !isIdentity && style.animationName !== 'none';
          })
          .map((element) => element.tagName.toLowerCase()),
      );
      expect(moving, 'elements still animating a transform').toEqual([]);
    });
  }
});
