import { expect, test } from '@playwright/test';

// PLAN 2.6: the home is the finder. This runs without emulators, so it checks what the home
// shows before anybody says where they are: nothing is searched and nothing fails.
test('the home renders without console errors or sideways scroll', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1 })).toContainText('Pide tu gas');
  const whereTo = page.getByRole('region', { name: 'Dónde entregar' });
  await expect(whereTo.getByRole('button', { name: 'Usar mi ubicación' })).toBeVisible();
  await expect(whereTo.getByRole('button', { name: 'Escribir las coordenadas' })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Dinos dónde y vemos quién llega.' }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Registrar mi distribuidora' })).toBeVisible();

  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflows).toBe(false);
  expect(errors).toEqual([]);
});

// PLAN 3.6: the home speaks to both audiences; owners read more on their own page.
test('the home leads owners to /para-distribuidoras and the page renders cleanly', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/');
  const paths = page.getByRole('navigation', { name: '¿Qué buscas?' });
  await expect(paths.getByRole('link', { name: /Quiero pedir gas/ })).toBeVisible();
  await paths.getByRole('link', { name: /Tengo una distribuidora/ }).click();

  await expect(page).toHaveURL(/\/para-distribuidoras$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('te encuentre');
  await expect(page.getByText('30 días de prueba, gratis y sin tarjeta.').first()).toBeVisible();
  await page.getByRole('link', { name: 'Registrar mi distribuidora' }).first().click();
  await expect(page).toHaveURL(/\/registro\?desde=%2Fdistribuidora%2Fnueva$/);

  const footer = page.getByRole('contentinfo');
  await expect(footer).toContainText('Hornilla no vende ni reparte gas.');
  await expect(footer.getByRole('link', { name: 'Para distribuidoras' })).toBeVisible();
  expect(errors).toEqual([]);
});
