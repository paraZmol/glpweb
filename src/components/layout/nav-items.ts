import {
  BadgePercent,
  Bike,
  Building2,
  ClipboardList,
  House,
  type LucideIcon,
  Map as MapIcon,
  Tags,
  Truck,
  User,
  Users,
  Warehouse,
} from 'lucide-react';
import { type AppArea, areaForRole } from '@/domain/auth/access';
import type { MemberRole } from '@/domain/tenancy/types';
import { AREA_HOME, ROUTES } from '@/lib/routes';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /**
   * Phone: other screens this destination stands for. It lights up on them too, and their
   * screens show the group as tabs on top (`sectionTabsFor`).
   */
  covers?: readonly string[];
}

/** The bottom bar of a phone or the side bar of a desktop: only the phone groups screens. */
export type NavLayout = 'phone' | 'desktop';

/**
 * The bottom bar of a phone never holds more than five destinations (ui-system §3); the side
 * bar of a desktop lists every screen.
 */
export const MAX_NAV_ITEMS = 5;

const ACCOUNT: NavItem = { to: ROUTES.account, label: 'Cuenta', icon: User };

const CUSTOMER: NavItem[] = [
  { to: ROUTES.customerHome, label: 'Inicio', icon: House },
  { to: ROUTES.customerOrders, label: 'Pedidos', icon: ClipboardList },
];

type WorkArea = Exclude<AppArea, 'customer'>;

/** The staff of the distributor: only its owners manage it (PLAN 3.2). */
const STAFF: NavItem = { to: ROUTES.officeStaff, label: 'Personal', icon: Users };

/**
 * Destinations of a work area after its home (PLAN 3.1, 3.3–3.5). Each inner list is one
 * destination on a phone (the first screen, covering the others) and one each on a desktop:
 * the catalogue with its promotions, and the plant (stock and vehicles). The driver reads the
 * vehicles and never sees the plant stock (PLAN §11, 2026-10-16).
 */
const navItem = (to: string, label: string, icon: LucideIcon): NavItem => ({ to, label, icon });
const PROMOTIONS = (to: string) => navItem(to, 'Promociones', BadgePercent);
const VEHICLES = (to: string) => navItem(to, 'Vehículos', Truck);

const MORE: Record<WorkArea, { label: string; icon: LucideIcon; items: NavItem[] }[]> = {
  office: [
    {
      label: 'Catálogo',
      icon: Tags,
      items: [navItem(ROUTES.officeCatalog, 'Catálogo', Tags), PROMOTIONS(ROUTES.officePromotions)],
    },
    {
      label: 'Planta',
      icon: Warehouse,
      items: [navItem(ROUTES.officeStock, 'Stock', Warehouse), VEHICLES(ROUTES.officeVehicles)],
    },
  ],
  driver: [
    {
      label: 'Catálogo',
      icon: Tags,
      items: [navItem(ROUTES.driverCatalog, 'Catálogo', Tags), PROMOTIONS(ROUTES.driverPromotions)],
    },
    { label: 'Vehículos', icon: Truck, items: [VEHICLES(ROUTES.driverVehicles)] },
  ],
  platform: [],
};

function moreOf(area: WorkArea, layout: NavLayout): NavItem[] {
  return MORE[area].flatMap(({ label, icon, items }) => {
    const [first, ...rest] = items;
    if (layout === 'desktop' || !first || rest.length === 0) return items;
    return [{ to: first.to, label, icon, covers: rest.map((item) => item.to) }];
  });
}

/**
 * Phone: the screens that share the destination of `pathname`, shown as tabs on top of it;
 * null when it shares it with none (or on another area).
 */
export function sectionTabsFor(area: AppArea, pathname: string): NavItem[] | null {
  if (area === 'customer') return null;
  const section = MORE[area].find(({ items }) => items.some((item) => item.to === pathname));
  return section && section.items.length > 1 ? section.items : null;
}

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
export function navItemsFor(
  area: AppArea,
  account: NavAccount,
  layout: NavLayout = 'desktop',
): NavItem[] {
  if (area !== 'customer') {
    const staff = area === 'office' && account.role === 'owner' ? [STAFF] : [];
    return [WORK[area].own, ...moreOf(area, layout), ...staff, ACCOUNT];
  }
  const shortcuts = workAreasOf(account).map((workArea) => WORK[workArea].shortcut);
  return [...CUSTOMER, ...shortcuts, ACCOUNT].slice(0, MAX_NAV_ITEMS);
}
