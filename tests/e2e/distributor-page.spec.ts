import { expect, test } from '@playwright/test';
import { SEED_DISTRIBUTORS } from '../seed/data';
import { dismissStorageNotice } from './support/storage-notice';

test.skip(
  process.env.E2E_EMULATORS !== 'true',
  'Needs the seeded emulators: run with E2E_EMULATORS=true',
);

const { a } = SEED_DISTRIBUTORS;

test.beforeEach(async ({ page }) => {
  await dismissStorageNotice(page);
});

// PLAN 2.5: the public page of a distributor, for a visitor without a session.
test('shows the public profile of a seeded distributor to anybody', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto(`/d/${a.slug}`);

  await expect(page.getByRole('heading', { level: 1 })).toHaveText(a.name);
  await expect(page).toHaveTitle(`${a.name} · Hornilla`);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    'content',
    new RegExp(`^${a.name}, distribuidora de gas en Hornilla`),
  );
  await expect(page.getByText(`${a.name} vende y reparte el gas`)).toBeVisible();
  await expect(page.getByText(`${a.coverageRadiusKm} km`, { exact: true })).toBeVisible();
  await expect(page.getByText(/7:00 a\. m\.–8:00 p\. m\./)).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Esta distribuidora todavía no publicó su catálogo.' }),
  ).toBeVisible();
  await expect(page.getByText('Página en')).toBeVisible();
  await expect(page.getByText('Solo tú ves esta página')).toHaveCount(0);
  // PLAN 2.11: anybody can report a page to the platform.
  await expect(page.getByRole('link', { name: 'Reportar esta distribuidora' })).toHaveAttribute(
    'href',
    '/contacto',
  );

  // Links built from the stored numbers, with the message encoded.
  await expect(page.getByRole('link', { name: /WhatsApp/ }).first()).toHaveAttribute(
    'href',
    new RegExp(`^https://wa\\.me/51${a.contactPhone}\\?text=Hola\\.%20`),
  );
  await expect(page.getByRole('link', { name: /Llamar al/ }).first()).toHaveAttribute(
    'href',
    `tel:+51${a.contactPhone}`,
  );

  // PLAN 2.9: nothing about the plan reaches a visitor.
  await expect(page.getByText(/prueba gratis|suspendid|plan activo|pago pendiente/i)).toHaveCount(
    0,
  );
  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflows).toBe(false);
  expect(errors).toEqual([]);
});

// PLAN 2.11: a distributor that is not open to the public (waiting for its review, suspended,
// trial over) hands a visitor neither its name nor its phones: its link answers "not found",
// exactly like a link nobody has. Before, the page showed with "no está recibiendo pedidos".
for (const hidden of [SEED_DISTRIBUTORS.c, SEED_DISTRIBUTORS.d, SEED_DISTRIBUTORS.e]) {
  test(`shows nothing of ${hidden.name} to a visitor: not its name, not its phone, not why`, async ({
    page,
  }) => {
    await page.goto(`/d/${hidden.slug}`);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Esta distribuidora no existe.',
    );
    const said = await page.locator('body').innerText();
    expect(said).not.toContain(hidden.name);
    expect(said).not.toContain(hidden.contactPhone);
    expect(said).not.toMatch(/suspendid|prueba terminada|pago pendiente|en revisión|aprob/i);
  });
}

test('has its own "not found" for a link of no distributor', async ({ page }) => {
  await page.goto('/d/esta-no-existe');

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Esta distribuidora no existe.');
  await expect(page).toHaveTitle('Distribuidora no encontrada · Hornilla');
  await page.getByRole('link', { name: 'Buscar distribuidoras' }).click();
  await expect(page).toHaveURL(/\/$/);
});
