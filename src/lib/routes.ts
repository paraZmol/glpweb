import type { AppArea } from '@/domain/auth/access';

/** Every path of the app, written once. Visible paths are in Spanish, like the interface. */
export const ROUTES = {
  home: '/',
  signIn: '/ingresar',
  /** The same screen as `signIn` with other words: the first sign-in creates the account. */
  register: '/registro',
  terms: '/terminos',
  privacy: '/privacidad',
  cookies: '/cookies',
  contact: '/contacto',
  /** Public page of one distributor; build a real path with `distributorPath`. */
  distributor: '/d/:slug',
  /** Sends a signed-in account to the area of its role. */
  appEntry: '/app',
  acceptTerms: '/aceptar-terminos',
  customerHome: '/inicio',
  customerOrders: '/pedidos',
  account: '/cuenta',
  newDistributor: '/distribuidora/nueva',
  driverHome: '/reparto',
  officeHome: '/central',
  /** The owner edits the public profile of the distributor (PLAN 2.11). */
  officeProfile: '/central/ficha',
  platformHome: '/plataforma',
  /** One listing under review; build a real path with `platformListingPath`. */
  platformListing: '/plataforma/altas/:distributorId',
} as const;

const DISTRIBUTOR_PREFIX = '/d/';

/** Path of the public page of the distributor that owns `slug` (PLAN 2.5). */
export function distributorPath(slug: string): string {
  return `${DISTRIBUTOR_PREFIX}${encodeURIComponent(slug)}`;
}

const LISTING_PREFIX = '/plataforma/altas/';

/** Path of the review of one listing in the platform panel (PLAN 2.11). */
export function platformListingPath(distributorId: string): string {
  return `${LISTING_PREFIX}${encodeURIComponent(distributorId)}`;
}

/**
 * Addresses that are one screen: the platform panel keeps its list (the pages loaded, where it
 * was scrolled) while a distributor is open beside it or over it, so moving between the two is
 * not a change of screen (`PageTransition` keys by this).
 */
export function screenKeyOf(pathname: string): string {
  return pathname.startsWith(LISTING_PREFIX) ? ROUTES.platformHome : pathname;
}

export const AREA_HOME: Record<AppArea, string> = {
  customer: ROUTES.customerHome,
  driver: ROUTES.driverHome,
  office: ROUTES.officeHome,
  platform: ROUTES.platformHome,
};

/** Told to the office home: the account has just founded this distributor (PLAN 2.2). */
export const JUST_FOUNDED_STATE = { justFounded: true } as const;

export function isJustFounded(state: unknown): boolean {
  return typeof state === 'object' && state !== null && 'justFounded' in state;
}

/** Query parameter that remembers where a visitor was going before being asked to sign in. */
export const RETURN_PARAM = 'desde';

const INTERNAL_PATH = /^\/(?![/\\])[^\\]*$/;
const FIRST_PRINTABLE_CODE = 0x20;
const DELETE_CODE = 0x7f;

function hasControlCharacter(text: string): boolean {
  return [...text].some((character) => {
    const code = character.charCodeAt(0);
    return code < FIRST_PRINTABLE_CODE || code === DELETE_CODE;
  });
}

/**
 * Accepts only a path inside this app. Anything that could leave the site (`//host`, `/\host`,
 * a scheme, control characters) is refused, so the parameter cannot be used to redirect a
 * person who has just signed in to somebody else's page.
 */
export function safeReturnPath(raw: string | null | undefined): string | null {
  if (!raw || !INTERNAL_PATH.test(raw) || hasControlCharacter(raw)) return null;
  const pathname = raw.split(/[?#]/)[0];
  const isAuthScreen = pathname === ROUTES.signIn || pathname === ROUTES.register;
  return isAuthScreen ? null : raw;
}

/** Path of the sign-in screen that returns to `from` afterwards. */
export function signInPathFrom(from: string): string {
  const target = safeReturnPath(from);
  if (target === null || target === ROUTES.home) return ROUTES.signIn;
  return `${ROUTES.signIn}?${RETURN_PARAM}=${encodeURIComponent(target)}`;
}

/** Path of the "crear cuenta" screen that remembers where the visitor was going (PLAN 2.11). */
export function registerPathFrom(from: string | null | undefined): string {
  const target = safeReturnPath(from);
  if (target === null || target === ROUTES.home) return ROUTES.register;
  return `${ROUTES.register}?${RETURN_PARAM}=${encodeURIComponent(target)}`;
}

/** The pending step and the entry never are a destination of their own. */
const NOT_A_DESTINATION: readonly string[] = [ROUTES.acceptTerms, ROUTES.appEntry, ROUTES.home];

/**
 * Where an account was going when the pending step (accept the terms) stood in its way. It travels in the navigation state, so the addresses of the steps stay clean and it
 * lasts as long as the tab (PLAN 2.11). Undefined when there is nowhere special to go.
 */
export function destinationState(from: string | null | undefined): { after: string } | undefined {
  const target = safeReturnPath(from);
  if (target === null || NOT_A_DESTINATION.includes(target.split(/[?#]/)[0] ?? '')) {
    return undefined;
  }
  return { after: target };
}

/** Reads what `destinationState` wrote, distrusting it like any other outside value. */
export function destinationOf(state: unknown): string | null {
  if (typeof state !== 'object' || state === null || !('after' in state)) return null;
  const { after } = state;
  return typeof after === 'string' ? (destinationState(after)?.after ?? null) : null;
}

export type TransitionDirection = 'forward' | 'back' | 'fade';

/** The two screens that list distributors: the page of one of them is their detail. */
const FINDER_SCREENS: readonly string[] = [ROUTES.home, ROUTES.customerHome];

function isDetailOf(child: string, parent: string): boolean {
  if (child.startsWith(DISTRIBUTOR_PREFIX) && FINDER_SCREENS.includes(parent)) return true;
  const base = parent.endsWith('/') ? parent : `${parent}/`;
  return parent !== ROUTES.home && child.startsWith(base);
}

/**
 * Spatial hierarchy of motion-system §3: going into a detail slides forward, coming back slides
 * the other way, and moving between sibling screens (tabs) only cross-fades.
 */
export function transitionDirection(from: string, to: string): TransitionDirection {
  if (isDetailOf(to, from)) return 'forward';
  if (isDetailOf(from, to)) return 'back';
  return 'fade';
}
