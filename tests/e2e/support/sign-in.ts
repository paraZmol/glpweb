import { expect, type Page } from '@playwright/test';
import { SEED_PASSWORD, SEED_USERS, type SeedUser } from '../../seed/data';

export type SeedUserKey = keyof typeof SEED_USERS;

const SIGN_IN_PATH = '/ingresar';

/** Where each seeded account lands after signing in (see `AREA_HOME` in src/lib/routes.ts). */
export const SEED_HOME_PATH: Record<SeedUserKey, string> = {
  ownerA: '/central',
  dispatcherA: '/central',
  driverA: '/reparto',
  ownerB: '/central',
  dispatcherB: '/central',
  driverB: '/reparto',
  ownerC: '/central',
  ownerD: '/central',
  customer: '/inicio',
  admin: '/plataforma',
  unverified: '/verificar-correo',
  noProfile: '/aceptar-terminos',
  // Before it founds anything. The sign-up test signs in by itself: afterwards it is an owner.
  founder: '/inicio',
};

/**
 * Signs in through the real form with one of the accounts of the seed (tests/seed/data.ts) and
 * waits until the app has taken it to its own area. Needs `E2E_EMULATORS=true`: the build then
 * talks to the emulators of the lane, already seeded.
 * Each actor of a multi-actor test uses its own `browser.newContext()`.
 */
export async function signInAsSeedUser(page: Page, key: SeedUserKey): Promise<SeedUser> {
  const user: SeedUser = SEED_USERS[key];
  await page.goto(SIGN_IN_PATH);
  await page.getByLabel('Correo', { exact: true }).fill(user.email);
  await page.getByLabel('Contraseña', { exact: true }).fill(SEED_PASSWORD);
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${SEED_HOME_PATH[key]}$`));
  return user;
}
