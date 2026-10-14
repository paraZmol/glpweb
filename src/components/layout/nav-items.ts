import {
  Bike,
  Building2,
  ClipboardList,
  House,
  type LucideIcon,
  Map as MapIcon,
  Tags,
  User,
} from 'lucide-react';
import { type AppArea, areaForRole } from '@/domain/auth/access';
import type { MemberRole } from '@/domain/tenancy/types';
import { AREA_HOME, ROUTES } from '@/lib/routes';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

/** The bottom bar of a phone never holds more than five destinations (ui-system §3). */
export const MAX_NAV_ITEMS = 5;

const ACCOUNT: NavItem = { to: ROUTES.account, label: 'Cuenta', icon: User };

const CUSTOMER: NavItem[] = [
  { to: ROUTES.customerHome, label: 'Inicio', icon: House },
  { to: ROUTES.customerOrders, label: 'Pedidos', icon: ClipboardList },
];

type WorkArea = Exclude<AppArea, 'customer'>;

/** Destinations of a work area after its home (PLAN 3.1: the catalogue, read-only for staff). */
const MORE: Record<WorkArea, NavItem[]> = {
  office: [{ to: ROUTES.officeCatalog, label: 'Catálogo', icon: Tags }],
  driver: [{ to: ROUTES.driverCatalog, label: 'Catálogo', icon: Tags }],
  platform: [],
};

/** How each work area is called from inside itself and from the customer area. */
const WORK: Record<WorkArea, { own: NavItem; shortcut: NavItem }> = {
  office: {
    own: { to: AREA_HOME.office, label: 'Monitor', icon: MapIcon },
    shortcut: { to: AREA_HOME.office, label: 'Central', icon: MapIcon },
  },
  driver: {
    own: { to: AREA_HOME.driver, label: 'Reparto', icon: Bike },
    shortcut: { to: AREA_HOME.driver, label: 'Reparto', icon: Bike },
  },
  platform: {
    own: { to: AREA_HOME.platform, label: 'Distribuidoras', icon: Building2 },
    shortcut: { to: AREA_HOME.platform, label: 'Plataforma', icon: Building2 },
  },
};

export interface NavAccount {
  role: MemberRole | null;
  isPlatformAdmin: boolean;
}

/** Work areas this account may open, its job first. Shown as shortcuts in the customer area. */
export function workAreasOf({ role, isPlatformAdmin }: NavAccount): WorkArea[] {
  const jobArea = areaForRole(role);
  const areas: WorkArea[] = jobArea === 'customer' ? [] : [jobArea];
  return isPlatformAdmin ? [...areas, 'platform'] : areas;
}

/**
 * Destinations of the navigation of an area (PLAN 2.4): the same list feeds the bottom bar of
 * the phone and the side bar of the desktop. "Cuenta" always comes last. A link here is only a
 * shortcut: who may open what is decided by the guards and, for the data, by the rules.
 */
export function navItemsFor(area: AppArea, account: NavAccount): NavItem[] {
  if (area !== 'customer') return [WORK[area].own, ...MORE[area], ACCOUNT];
  const shortcuts = workAreasOf(account).map((workArea) => WORK[workArea].shortcut);
  return [...CUSTOMER, ...shortcuts, ACCOUNT].slice(0, MAX_NAV_ITEMS);
}
