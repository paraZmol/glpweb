import { test as base, type BrowserContext, devices, type Page } from '@playwright/test';
import type { SeedUser } from '../../seed/data';
import { type SeedUserKey, signInAsSeedUser } from './sign-in';
import { dismissStorageNotice } from './storage-notice';

/** Phone for whoever is on the street, desktop for whoever sits at the office (PLAN §6). */
export const PHONE = { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } };
export const DESKTOP = { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } };

export type Device = typeof PHONE | typeof DESKTOP;

const PHONE_ACTORS: readonly SeedUserKey[] = ['customer', 'driverA', 'driverB'];

/** The device a seeded account uses in a flow: customers and drivers carry a phone. */
export function deviceOf(key: SeedUserKey): Device {
  return PHONE_ACTORS.includes(key) ? PHONE : DESKTOP;
}

export interface Actor {
  context: BrowserContext;
  page: Page;
  /** Uncaught errors of every tab of this actor; a flow ends with `expect(errors).toEqual([])`. */
  errors: string[];
}

export interface SeedActor extends Actor {
  user: SeedUser;
}

export interface Actors {
  /**
   * One person of a flow: their own browser context (own session, own storage) on their own
   * kind of device, with the storage notice already read.
   */
  open: (device: Device) => Promise<Actor>;
  /** A seeded account, signed in on the device of its role and standing on its own area. */
  openSeed: (key: SeedUserKey) => Promise<SeedActor>;
}

/**
 * `test` with the `actors` fixture: every person of a multi-actor flow is opened through it,
 * and their contexts are closed when the test ends (a context opened by hand with
 * `browser.newContext()` would stay open for the next test of the worker).
 */
export const test = base.extend<{ actors: Actors }>({
  actors: async ({ browser }, use) => {
    const contexts: BrowserContext[] = [];
    const open = async (device: Device): Promise<Actor> => {
      const context = await browser.newContext(device);
      contexts.push(context);
      await dismissStorageNotice(context);
      const errors: string[] = [];
      context.on('weberror', (webError) => errors.push(webError.error().message));
      return { context, page: await context.newPage(), errors };
    };
    const openSeed = async (key: SeedUserKey): Promise<SeedActor> => {
      const actor = await open(deviceOf(key));
      return { ...actor, user: await signInAsSeedUser(actor.page, key) };
    };
    await use({ open, openSeed });
    await Promise.all(contexts.map((context) => context.close()));
  },
});

/**
 * For a file whose actors choose their own device: the phone project would only repeat the
 * same run, so the flow runs once, under the desktop project.
 */
export function runOncePerActorDevices(): void {
  base.skip(
    ({ isMobile }) => isMobile,
    'Each actor of this flow opens its own device: it runs once, under the desktop project',
  );
}
