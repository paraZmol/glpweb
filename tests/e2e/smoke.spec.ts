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
  await expect(page.getByRole('link', { name: 'Súmala a Hornilla' })).toBeVisible();

  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflows).toBe(false);
  expect(errors).toEqual([]);
});
