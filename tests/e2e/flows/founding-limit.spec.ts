import { expect, test } from '@playwright/test';
import { createTestAccount, readDocument, uniqueTag } from '../support/emulator-admin';
import { foundDistributor } from '../support/founding';
import { signInWithPassword } from '../support/sign-in';
import { dismissStorageNotice } from '../support/storage-notice';

test.skip(
  process.env.E2E_EMULATORS !== 'true',
  'Needs the seeded emulators: run with E2E_EMULATORS=true',
);
// Three whole sign-ups, one after the other.
test.slow();

const MAX_DISTRIBUTORS = 3;
const ORDINALS = ['uno', 'dos', 'tres'];

// PLAN 2.2 and the cap of PLAN §11: one account founds up to three distributors.
test('an account founds three distributors and the fourth attempt shows the cap', async ({
  page,
}, testInfo) => {
  const tag = uniqueTag(testInfo);
  const account = await createTestAccount(tag);
  await dismissStorageNotice(page);
  await signInWithPassword(page, account.email, '/inicio');

  for (const ordinal of ORDINALS) {
    await foundDistributor(page, {
      name: `Gas Tope ${ordinal} ${tag}`,
      slug: `tope-${ordinal}-${tag}`,
    });
  }

  // The panel opens on the last one, and the selector offers the three.
  const profile = await readDocument(`users/${account.uid}`);
  expect(profile?.ownedDistributorIds).toHaveLength(MAX_DISTRIBUTORS);
  await expect(page.getByLabel('Cambiar de distribuidora').getByRole('option')).toHaveCount(
    MAX_DISTRIBUTORS,
  );

  await page.goto('/distribuidora/nueva');

  await expect(
    page.getByRole('heading', { name: `Ya registraste ${MAX_DISTRIBUTORS} distribuidoras.` }),
  ).toBeVisible();
  await expect(page.getByLabel('Nombre de la distribuidora')).toHaveCount(0);
  await page.getByRole('link', { name: 'Ir a mi central' }).click();
  await expect(page).toHaveURL(/\/central$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(`Hoy en Gas Tope tres ${tag}.`);
});
