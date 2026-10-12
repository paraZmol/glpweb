import { describe, expect, it } from 'vitest';
import { APP_AREAS } from '@/domain/auth/access';
import { MEMBER_ROLES } from '@/domain/tenancy/types';
import { MAX_NAV_ITEMS, navItemsFor, workAreasOf } from './nav-items';

const ROLES = [...MEMBER_ROLES, null];
const ACCOUNTS = ROLES.flatMap((role) => [
  { role, isPlatformAdmin: false },
  { role, isPlatformAdmin: true },
]);
const labels = (...args: Parameters<typeof navItemsFor>) =>
  navItemsFor(...args).map((item) => item.label);

// PLAN 2.4: bottom bar on the phone (five at most), side bar on desktop, by role.
describe('navItemsFor', () => {
  it.each(APP_AREAS)('never gives the %s area more than five destinations', (area) => {
    for (const account of ACCOUNTS) {
      const items = navItemsFor(area, account);

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

  it.each([
    ['office', 'Monitor'],
    ['driver', 'Reparto'],
    ['platform', 'Distribuidoras'],
  ] as const)('keeps the %s area to its own screen and the account', (area, own) => {
    expect(labels(area, { role: 'owner', isPlatformAdmin: true })).toEqual([own, 'Cuenta']);
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
