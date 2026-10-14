import { expect, type Page } from '@playwright/test';
import { googleIdOf, SEED_USERS, type SeedUser } from '../../seed/data';

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
  ownerE: '/central',
  customer: '/inicio',
  admin: '/plataforma',
  // No screen of its own: the guard of whatever it asks for says its e-mail is not confirmed.
  unverified: '/app',
  noProfile: '/aceptar-terminos',
  // Before it founds anything. The sign-up test signs in by itself: afterwards it is an owner.
  founder: '/inicio',
};

/** Whoever a test signs in as: a seeded account, one it created, or a newcomer it makes up. */
export interface E2eIdentity {
  email: string;
  displayName: string;
  /** False pretends a Google answer without a confirmed address. Default true. */
  emailVerified?: boolean;
}

/**
 * Opens the session of `identity` on the page that is showing, the way "Continuar con Google"
 * does once Google answers (PLAN 2.1): the Auth emulator pretends that answer, so no window
 * opens. It goes through the entry only a test build has (`src/features/auth/e2e-entry.ts`).
 * An e-mail nobody used yet gets a new account, like a real first sign-in. What the app does
 * next (where it goes, what it asks for) is the app's own doing: the caller waits for it.
 * `tests/e2e/google-sign-in.spec.ts` is the test that presses the real button instead.
 */
export async function signInHere(page: Page, identity: E2eIdentity): Promise<void> {
  await page.waitForFunction(() => typeof window.hornillaE2eSignIn === 'function');
  await page.evaluate(
    async (claims) => {
      await window.hornillaE2eSignIn?.(claims);
    },
    {
      sub: googleIdOf(identity.email),
      email: identity.email,
      name: identity.displayName,
      emailVerified: identity.emailVerified ?? true,
    },
  );
}

/**
 * Opens the sign-in screen, signs in as `identity` and waits until the app has taken it to
 * `landsOn`, a path.
 */
export async function signInAs(page: Page, identity: E2eIdentity, landsOn: string): Promise<void> {
  await page.goto(SIGN_IN_PATH);
  await signInHere(page, identity);
  await expect(page).toHaveURL(new RegExp(`${landsOn}$`));
}

/**
 * Signs in with one of the accounts of the seed (tests/seed/data.ts) and waits until the app
 * has taken it to its own area. Needs `E2E_EMULATORS=true`: the build then talks to the
 * emulators of the lane, already seeded.
 * Each actor of a multi-actor test uses its own `browser.newContext()`.
 */
export async function signInAsSeedUser(page: Page, key: SeedUserKey): Promise<SeedUser> {
  const user: SeedUser = SEED_USERS[key];
  await signInAs(page, user, SEED_HOME_PATH[key]);
  return user;
}
