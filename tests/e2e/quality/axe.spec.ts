// Quality (testing-strategy §7, perf-a11y-auditor): automatic accessibility check with axe on
// every main screen, light and dark. Any WCAG 2.2 A/AA or best-practice violation fails the run,
// so a later change that hides a button name or loses contrast is caught in CI.
// Public pages and the plant need the seeded emulators; sign-in and legal pages do not.
import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';
import { SEED_USERS } from '../../seed/data';
import { signInAs } from '../support/sign-in';
import { dismissStorageNotice } from '../support/storage-notice';

const withEmulators = process.env.E2E_EMULATORS === 'true';
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];
const SCHEMES = ['light', 'dark'] as const;

const OPEN_SCREENS = ['/ingresar', '/terminos'] as const;
const SEEDED_PUBLIC_SCREENS = ['/', '/para-distribuidoras', '/d/gas-demo-norte'] as const;
const OFFICE_SCREENS = [
  '/central',
  '/central/catalogo',
  '/central/personal',
  '/central/stock',
  '/central/promociones',
  '/central/vehiculos',
] as const;

async function expectNoViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  expect(
    violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target).join(' | ')}`),
    'axe violations',
  ).toEqual([]);
}

for (const scheme of SCHEMES) {
  test.describe(`axe, ${scheme}`, () => {
    test.use({ colorScheme: scheme });

    for (const path of OPEN_SCREENS) {
      test(`${path} has no violations`, async ({ page }) => {
        await dismissStorageNotice(page);
        await page.goto(path);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        await expectNoViolations(page);
      });
    }

    test.describe('with the seeded emulators', () => {
      test.skip(!withEmulators, 'Needs the seeded emulators: run with E2E_EMULATORS=true');

      for (const path of SEEDED_PUBLIC_SCREENS) {
        test(`${path} has no violations`, async ({ page }) => {
          await dismissStorageNotice(page);
          await page.goto(path);
          await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
          await expectNoViolations(page);
        });
      }

      for (const path of OFFICE_SCREENS) {
        test(`${path} has no violations`, async ({ page }) => {
          await dismissStorageNotice(page);
          await signInAs(page, SEED_USERS.ownerA, '/central');
          await page.goto(path);
          await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
          await expectNoViolations(page);
        });
      }
    });
  });
}
