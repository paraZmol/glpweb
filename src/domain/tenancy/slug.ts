export const SLUG_MIN_LENGTH = 3;
export const SLUG_MAX_LENGTH = 40;

/**
 * Links the app needs for itself (`/d/{slug}` shares the namespace with future short links).
 * firebase/firestore.rules carries the same list; a rules test fails if they drift apart.
 */
export const RESERVED_SLUGS = [
  'admin',
  'api',
  'app',
  'd',
  'www',
  'plataforma',
  'platform',
  'ingresar',
  'registro',
  'registrarse',
  'salir',
  'login',
  'logout',
  'signup',
  'cuenta',
  'perfil',
  'pedido',
  'pedidos',
  'repartidor',
  'central',
  'oficina',
  'panel',
  'buscar',
  'inicio',
  'ayuda',
  'soporte',
  'contacto',
  'precios',
  'planes',
  'terminos',
  'privacidad',
  'hornilla',
  'glpweb',
  'assets',
  'static',
  'null',
  'undefined',
] as const;

/**
 * No link may carry the name of the platform, wherever it sits in it: `hornilla-oficial` or
 * `soporte-glpweb` would pass for the platform itself. The rules repeat the check.
 */
export const RESERVED_SLUG_FRAGMENTS = ['hornilla', 'glpweb'] as const;

/** Lowercase letters and digits in groups joined by single hyphens; never a hyphen at an edge. */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const COMBINING_MARKS = /[̀-ͯ]/g;
const NOT_SLUG_CHARACTERS = /[^a-z0-9]+/g;
const EDGE_HYPHENS = /^-+|-+$/g;
const FALLBACK_SUFFIX = '-gas';

export type SlugIssue = 'tooShort' | 'tooLong' | 'invalidCharacters' | 'reserved';

/**
 * Turns free text into slug shape: no accents (ñ → n), lowercase, anything else becomes a single
 * hyphen, no hyphens at the edges, cut to the maximum length. The result can still be too short
 * or reserved: check it with `validateSlug`.
 */
export function normalizeSlug(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .toLowerCase()
    .replace(NOT_SLUG_CHARACTERS, '-')
    .replace(EDGE_HYPHENS, '')
    .slice(0, SLUG_MAX_LENGTH)
    .replace(EDGE_HYPHENS, '');
}

/** Returns why the slug is not acceptable, or null when it is. Does not normalise. */
export function validateSlug(slug: string): SlugIssue | null {
  if (slug.length < SLUG_MIN_LENGTH) return 'tooShort';
  if (slug.length > SLUG_MAX_LENGTH) return 'tooLong';
  if (!SLUG_PATTERN.test(slug)) return 'invalidCharacters';
  if ((RESERVED_SLUGS as readonly string[]).includes(slug)) return 'reserved';
  if (RESERVED_SLUG_FRAGMENTS.some((fragment) => slug.includes(fragment))) return 'reserved';
  return null;
}

export function isValidSlug(slug: string): boolean {
  return validateSlug(slug) === null;
}

/**
 * Suggests a slug for a business name. A name that normalises to something too short or
 * reserved gets a suffix; an empty string means there is nothing usable to suggest.
 */
export function slugFromName(name: string): string {
  const base = normalizeSlug(name);
  if (base === '') return '';
  if (isValidSlug(base)) return base;
  const room = SLUG_MAX_LENGTH - FALLBACK_SUFFIX.length;
  const suffixed = `${base.slice(0, room).replace(EDGE_HYPHENS, '')}${FALLBACK_SUFFIX}`;
  return isValidSlug(suffixed) ? suffixed : '';
}
