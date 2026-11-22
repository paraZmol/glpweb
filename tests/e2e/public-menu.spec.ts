import { expect, test } from '@playwright/test';

// PLAN §11 2026-10-16: the public pages have a main menu; the sections are anchors of the home.
test.describe('public menu on desktop', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('leads to the home sections from another page and to the owners page', async ({ page }) => {
    await page.goto('/para-distribuidoras');
    const menu = page.getByRole('banner').getByRole('navigation', { name: 'Menú principal' });
    await expect(menu.getByRole('link', { name: 'Para distribuidoras' })).toHaveAttribute(
      'aria-current',
      'page',
    );

    await menu.getByRole('link', { name: 'Seguridad' }).click();
    await expect(page).toHaveURL(/\/#seguridad$/);
    await expect(page.getByRole('heading', { name: 'Tu seguridad primero' })).toBeInViewport();
    // The sticky header does not cover the section title.
    const title = await page.getByRole('heading', { name: 'Tu seguridad primero' }).boundingBox();
    const header = await page.getByRole('banner').boundingBox();
    expect(title!.y).toBeGreaterThanOrEqual(header!.y + header!.height);

    await menu.getByRole('link', { name: 'Para distribuidoras' }).click();
    await expect(page).toHaveURL(/\/para-distribuidoras$/);
    await expect(page.getByRole('button', { name: 'Abrir menú' })).toBeHidden();
  });
});

test.describe('public menu on the phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('opens, closes with Escape and closes on a link tap', async ({ page }, info) => {
    test.skip(info.project.name !== 'movil', 'phone menu');
    await page.goto('/');
    const toggle = page.getByRole('button', { name: 'Abrir menú' });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByRole('banner').getByRole('link', { name: 'Ingresar' })).toBeVisible();

    await toggle.click();
    const close = page.getByRole('button', { name: 'Cerrar menú' });
    await expect(close).toHaveAttribute('aria-expanded', 'true');
    const menu = page.getByRole('navigation', { name: 'Menú principal' });
    await expect(menu.getByRole('link')).toHaveCount(6);
    await expect(menu.getByRole('link', { name: 'Inicio' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(toggle).toBeFocused();

    await toggle.click();
    await menu.getByRole('link', { name: 'Preguntas' }).click();
    await expect(menu).toBeHidden();
    await expect(page).toHaveURL(/\/#preguntas$/);
    await expect(page.getByRole('heading', { name: 'Preguntas frecuentes' })).toBeInViewport();
  });
});
