import { describe, expect, it } from 'vitest';
import { APP_AREAS } from '@/domain/auth/access';
import { MEMBER_ROLES } from '@/domain/tenancy/types';
import { ROUTES } from '../../lib/routes';
import { MAX_NAV_ITEMS, navItemsFor, sectionTabsFor, workAreasOf } from './nav-items';

const ROLES = [...MEMBER_ROLES, null];
const ACCOUNTS = ROLES.flatMap((role) => [
  { role, isPlatformAdmin: false },
  { role, isPlatformAdmin: true },
]);
const labels = (...args: Parameters<typeof navItemsFor>) =>
  navItemsFor(...args).map((item) => item.label);

// PLAN 2.4: bottom bar on the phone (five at most), side bar on desktop, by role.
describe('navItemsFor', () => {
  it.each(APP_AREAS)('never gives the %s area more than five destinations on a phone', (area) => {
    for (const account of ACCOUNTS) {
      const items = navItemsFor(area, account, 'phone');

      expect(items.length).toBeLessThanOrEqual(MAX_NAV_ITEMS);
      expect(new Set(items.map((item) => item.to)).size).toBe(items.length);
    }
  });

  it.each(APP_AREAS)('always ends the %s area with the account', (area) => {
    for (const account of ACCOUNTS) {
      expect(navItemsFor(area, account).at(-1)?.label).toBe('Cuenta');
    }
  });

  it('shows a customer only the three destinations of the customer area', () => {
    expect(labels('customer', { role: null, isPlatformAdmin: false })).toEqual([
      'Inicio',
      'Pedidos',
      'Cuenta',
    ]);
  });

  it.each([
    ['owner', 'Central'],
    ['dispatcher', 'Central'],
    ['driver', 'Reparto'],
  ] as const)('gives a %s a shortcut to its work area', (role, shortcut) => {
    expect(labels('customer', { role, isPlatformAdmin: false })).toEqual([
      'Inicio',
      'Pedidos',
      shortcut,
      'Cuenta',
    ]);
  });

  it('adds the platform panel only for a platform admin', () => {
    expect(labels('customer', { role: null, isPlatformAdmin: true })).toContain('Plataforma');
    expect(labels('customer', { role: 'owner', isPlatformAdmin: false })).not.toContain(
      'Plataforma',
    );
  });

  // PLAN 3.1, 3.3–3.5: the catalogue, the promotions, the plant stock and the vehicles.
  it.each([
    ['office', ['Monitor', 'Catálogo', 'Promociones', 'Stock', 'Vehículos', 'Personal', 'Cuenta']],
    ['driver', ['Reparto', 'Catálogo', 'Promociones', 'Vehículos', 'Cuenta']],
    ['platform', ['Distribuidoras', 'Cuenta']],
  ] as const)('lists every screen of the %s area on a desktop', (area, expected) => {
    expect(labels(area, { role: 'owner', isPlatformAdmin: true })).toEqual(expected);
  });

  it.each([
    ['office', ['Monitor', 'Catálogo', 'Planta', 'Personal', 'Cuenta']],
    ['driver', ['Reparto', 'Precios', 'Vehículos', 'Cuenta']],
  ] as const)('groups the screens of the %s area on a phone', (area, expected) => {
    expect(labels(area, { role: 'owner', isPlatformAdmin: false }, 'phone')).toEqual(expected);
  });

  // PLAN §11, 2026-10-16: the driver never sees the plant stock, not even as a link.
  it('never takes the driver to the plant stock', () => {
    for (const layout of ['phone', 'desktop'] as const) {
      const items = navItemsFor('driver', { role: 'driver', isPlatformAdmin: false }, layout);
      expect(items.flatMap((item) => [item.to, ...(item.covers ?? [])])).not.toContain(
        ROUTES.officeStock,
      );
    }
  });
});

describe('sectionTabsFor', () => {
  it('shows the catalogue and its promotions as tabs of one destination', () => {
    expect(sectionTabsFor('office', ROUTES.officePromotions)?.map((item) => item.label)).toEqual([
      'Catálogo',
      'Promociones',
    ]);
  });

  it('shows the plant stock and the vehicles as tabs of the plant', () => {
    expect(sectionTabsFor('office', ROUTES.officeVehicles)?.map((item) => item.label)).toEqual([
      'Stock',
      'Vehículos',
    ]);
  });

  it('gives a screen of its own no tabs', () => {
    expect(sectionTabsFor('driver', ROUTES.driverVehicles)).toBeNull();
    expect(sectionTabsFor('office', ROUTES.officeStaff)).toBeNull();
  });
});

// PLAN 3.2: the staff is managed by its owners; the dispatcher does not get the link.
describe('staff destination', () => {
  it.each([
    ['owner', true],
    ['dispatcher', false],
  ] as const)('a %s of the office sees "Personal": %s', (role, isShown) => {
    expect(labels('office', { role, isPlatformAdmin: false }).includes('Personal')).toBe(isShown);
  });
});

describe('workAreasOf', () => {
  it.each([
    [null, false, []],
    [null, true, ['platform']],
    ['owner', false, ['office']],
    ['dispatcher', true, ['office', 'platform']],
    ['driver', false, ['driver']],
  ] as const)('role %s, admin %s → %j', (role, isPlatformAdmin, expected) => {
    expect(workAreasOf({ role, isPlatformAdmin })).toEqual(expected);
  });
});
