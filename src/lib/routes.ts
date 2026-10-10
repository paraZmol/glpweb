import type { AppArea } from '@/domain/auth/access';

/** Every path of the app, written once. Visible paths are in Spanish, like the interface. */
export const ROUTES = {
  home: '/',
  signIn: '/ingresar',
  register: '/registro',
  resetPassword: '/restablecer',
  terms: '/terminos',
  privacy: '/privacidad',
  cookies: '/cookies',
  /** Sends a signed-in account to the area of its role. */
  appEntry: '/app',
  verifyEmail: '/verificar-correo',
  acceptTerms: '/aceptar-terminos',
  customerHome: '/inicio',
  customerOrders: '/pedidos',
  account: '/cuenta',
  driverHome: '/reparto',
  officeHome: '/central',
  platformHome: '/plataforma',
} as const;

export const AREA_HOME: Record<AppArea, string> = {
  customer: ROUTES.customerHome,
  driver: ROUTES.driverHome,
  office: ROUTES.officeHome,
  platform: ROUTES.platformHome,
};

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

export type TransitionDirection = 'forward' | 'back' | 'fade';

/** Screens that are a detail of another one without sharing its path. */
const PARENT_OF: Record<string, string> = {
  [ROUTES.resetPassword]: ROUTES.signIn,
};

function isDetailOf(child: string, parent: string): boolean {
  if (PARENT_OF[child] === parent) return true;
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
