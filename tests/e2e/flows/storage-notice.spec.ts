// The storage notice of a first visit (PLAN 2.7) never sits on top of a control. Every other
// browser test marks the notice as read before its first screen (`dismissStorageNotice`), so
// none of them sees what a person sees the first time: this file does NOT, on the four screens
// where the notice used to cover something (role-walker, 2026-10-11). Each test runs under the
// two projects, so every screen is checked at 390 px and at 1440 px.
import { expect, type Locator, type Page } from '@playwright/test';
import { SEED_CUSTOMER_LOCATION, SEED_DISTRIBUTORS } from '../../seed/data';
import { DESKTOP, test } from '../support/actors';
import { createTestAccount, uniqueTag } from '../support/emulator-admin';
import { foundDistributor } from '../support/founding';
import { signInAsSeedUser, signInWithPassword } from '../support/sign-in';

test.skip(
  process.env.E2E_EMULATORS !== 'true',
  'Needs the seeded emulators: run with E2E_EMULATORS=true',
);

const notice = (page: Page) => page.getByRole('region', { name: 'Aviso de almacenamiento' });

/**
 * The control is on screen with the notice still open, and what a finger would hit in its very
 * middle is the control itself, not something lying over it. The click that follows in each
 * test proves the same by doing it.
 */
async function expectUncovered(page: Page, control: Locator): Promise<void> {
  await expect(notice(page)).toBeVisible();
  await control.scrollIntoViewIfNeeded();
  await expect(control).toBeInViewport();
  const isOnTop = () =>
    control.evaluate((element) => {
      const box = element.getBoundingClientRect();
      const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
      return hit !== null && element.contains(hit);
    });
  // The answers of a question ignore the pointer for an instant after it appears (so a double
  // click does not answer it): what matters is that the control ends up reachable.
  await expect.poll(isOnTop, { message: 'something lies over the control' }).toBe(true);
}

test('home: "Usar mi ubicación" is free, and it searches', async ({ page, context }) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({
    latitude: SEED_CUSTOMER_LOCATION.lat,
    longitude: SEED_CUSTOMER_LOCATION.lng,
  });
  await page.goto('/');
  const locate = page.getByRole('button', { name: 'Usar mi ubicación' });

  // The notice opens the first view and does not push the way in out of it: the whole button
  // shows without scrolling, at 390 × 844 too (ux-reviewer, 2026-10-12), with nothing over it.
  await expect(notice(page)).toBeInViewport();
  await expect(locate).toBeInViewport({ ratio: 1 });
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await expectUncovered(page, locate);
  await locate.click();

  await expect(page.getByRole('heading', { name: 'Llegan a tu punto' })).toBeVisible();
  // Reading it is the only thing that takes it away.
  await expect(notice(page)).toBeVisible();
  const understood = notice(page).getByRole('button', { name: 'Entendido' });
  // Compact to the eye, but a finger still gets its 44 px (ui-system §3).
  const touchHeight = await understood.evaluate((element) =>
    parseFloat(getComputedStyle(element, '::before').height),
  );
  expect(touchHeight).toBeGreaterThanOrEqual(44);
  await understood.click();
  await expect(notice(page)).toHaveCount(0);
});

test('office: "Guardar cambios" at the end of the listing is free, and it saves', async ({
  actors,
  page,
}, testInfo) => {
  // Founding takes a whole wizard: the listing is founded apart, the first visit is `page`.
  test.slow();
  const tag = uniqueTag(testInfo);
  const account = await createTestAccount(tag);
  const founder = await actors.open(DESKTOP);
  await signInWithPassword(founder.page, account.email, '/inicio');
  await foundDistributor(founder.page, { name: `Gas Aviso ${tag}`, slug: `aviso-${tag}` });

  await signInWithPassword(page, account.email, '/central');
  await page.goto('/central/ficha');
  await page.getByLabel('Dirección de la planta').fill('Av. Ensayo 702');
  const save = page.getByRole('button', { name: 'Guardar cambios' });

  await expectUncovered(page, save);
  await save.click();

  await expect(page).toHaveURL(/\/central$/);
});

test('account: "Cerrar sesión" is free, and it signs out', async ({ page }) => {
  await signInAsSeedUser(page, 'customer');
  await page.goto('/cuenta');
  const signOut = page.getByRole('button', { name: 'Cerrar sesión' });

  await expectUncovered(page, signOut);
  await signOut.click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('banner').getByRole('link', { name: 'Ingresar' })).toBeVisible();
});

test('platform: the error of the note and the buttons of the decision are free', async ({
  page,
}) => {
  await signInAsSeedUser(page, 'admin');
  await page.goto(`/plataforma/altas/${SEED_DISTRIBUTORS.e.id}`);
  const ask = page.getByRole('button', { name: 'Pedir cambios', exact: true });

  await expectUncovered(page, ask);
  await ask.click();
  const send = page.getByRole('button', { name: 'Enviar nota' });
  await expectUncovered(page, send);
  // Sent empty on purpose: nothing is decided, and the reason shows next to the note.
  await send.click();

  const problem = page.getByText(
    'Escribe qué debe corregir: es lo que la distribuidora va a leer en su panel.',
  );
  await expectUncovered(page, problem);
  const cancel = page.getByRole('button', { name: 'Cancelar' });
  await expectUncovered(page, cancel);
  await cancel.click();
  await expect(send).toHaveCount(0);
});
