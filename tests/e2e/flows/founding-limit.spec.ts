import { expect, test } from '@playwright/test';
import {
  createTestAccount,
  readDocument,
  uniqueTag,
  writeDocument,
} from '../support/emulator-admin';
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
const BLOCKED = 'Por ahora no puedes registrar otra distribuidora.';
const TWENTY_DAYS_MS = 20 * 24 * 60 * 60 * 1000;

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

// PLAN 2.11: the distributor that blocks a new sign-up need not be the one the panels show.
test('a suspended distributor that is not the selected one stops the sign-up before the form', async ({
  page,
}, testInfo) => {
  const tag = uniqueTag(testInfo);
  const account = await createTestAccount(tag);
  await dismissStorageNotice(page);
  await signInWithPassword(page, account.email, '/inicio');
  const first = { name: `Gas Bloqueo uno ${tag}`, slug: `bloqueo-uno-${tag}` };
  await foundDistributor(page, first);
  await foundDistributor(page, { name: `Gas Bloqueo dos ${tag}`, slug: `bloqueo-dos-${tag}` });
  // With both in good standing the account is still offered another sign-up.
  await page.goto('/cuenta');
  await expect(page.getByRole('link', { name: 'Registrar mi distribuidora' })).toBeVisible();

  // The platform suspends the first one; the panels keep showing the second, which is fine.
  const link = await readDocument(`slugs/${first.slug}`);
  await writeDocument(`distributors/${String(link?.distributorId)}/private/control`, {
    ownerUid: account.uid,
    status: 'suspended',
    trialEndsAt: new Date(Date.now() + TWENTY_DAYS_MS),
    listingApproved: false,
    distributorName: first.name,
    slug: first.slug,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  await page.goto('/cuenta');
  await expect(page.getByRole('heading', { name: BLOCKED })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Registrar mi distribuidora' })).toHaveCount(0);
  await page.goto('/distribuidora/nueva');
  await expect(page.getByRole('heading', { name: BLOCKED })).toBeVisible();
  await expect(page.getByLabel('Nombre de la distribuidora')).toHaveCount(0);
  // The office it lands on is still the healthy one.
  await page.getByRole('link', { name: 'Ir a mi central' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    `Hoy en Gas Bloqueo dos ${tag}.`,
  );
});
