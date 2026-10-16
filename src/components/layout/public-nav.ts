import { ROUTES } from '@/lib/routes';

/** Anchors of the home sections the public menu leads to (PLAN §11, 2026-10-16). */
export const HOME_ANCHORS = {
  whatIs: 'que-es-hornilla',
  howItWorks: 'como-funciona',
  safety: 'seguridad',
  faq: 'preguntas',
} as const;

export type PublicNavLink = { to: string; label: string };

const onHome = (anchor: string) => `${ROUTES.home}#${anchor}`;

/** The public menu, the same on desktop and in the phone sheet. "Ingresar" lives apart. */
export const PUBLIC_NAV: readonly PublicNavLink[] = [
  { to: ROUTES.home, label: 'Inicio' },
  { to: onHome(HOME_ANCHORS.whatIs), label: 'Qué es Hornilla' },
  { to: onHome(HOME_ANCHORS.howItWorks), label: 'Cómo funciona' },
  { to: onHome(HOME_ANCHORS.safety), label: 'Seguridad' },
  { to: onHome(HOME_ANCHORS.faq), label: 'Preguntas' },
  { to: ROUTES.forDistributors, label: 'Para distribuidoras' },
];

/** Whether a menu link is where the visitor is: the page, and on the home also the section. */
export function isCurrentLink(to: string, pathname: string, hash: string): boolean {
  const [path = '', anchor = ''] = to.split('#');
  if (path !== pathname) return false;
  return anchor === hash.replace(/^#/, '');
}
