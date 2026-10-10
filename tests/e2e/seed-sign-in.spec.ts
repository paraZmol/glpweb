import { expect, test } from '@playwright/test';
import { signInAsSeedUser } from './support/sign-in';
import { dismissStorageNotice } from './support/storage-notice';

// Proof that the E2E base works end to end: emulators of the lane, seed, a build that talks to
// them and the sign-in helper. Run with:
//   E2E_LANE=N E2E_EMULATORS=true npx playwright test tests/e2e/seed-sign-in.spec.ts
test.skip(
  process.env.E2E_EMULATORS !== 'true',
  'Needs the seeded emulators: run with E2E_EMULATORS=true',
);

test('the seeded customer signs in and lands on its home', async ({ page }) => {
  await dismissStorageNotice(page);

  const customer = await signInAsSeedUser(page, 'customer');

  const firstName = customer.displayName.split(' ')[0] ?? '';
  await expect(page.getByRole('heading', { level: 1 })).toContainText(`Hola, ${firstName}`);
});
