import { describe, expect, it } from 'vitest';
import { DEFAULT_SCHEDULE } from './constants';
import { findNearbyDistributors } from './nearby';
import type { Distributor } from './types';

const NOW = new Date('2026-03-10T15:00:00Z');
const HOME = { lat: -12.0464, lng: -77.0428 };
const KM_IN_DEGREES = 0.009;

function distributor(id: string, change: Partial<Distributor> = {}): Distributor {
  return {
    id,
    name: `Gas Demo ${id}`,
    slug: `gas-demo-${id}`,
    ownerUid: `owner-${id}`,
    contactPhone: '900000001',
    whatsapp: '900000001',
    addressLine: '',
    plant: HOME,
    coverageRadiusKm: 5,
    brandColor: '#d9480f',
    status: 'active',
    trialEndsAt: new Date('2026-01-01T00:00:00Z'),
    schedule: { ...DEFAULT_SCHEDULE, days: [...DEFAULT_SCHEDULE.days] },
    maxCylindersPerOrder: 3,
    brands: [],
    priceFromCents: null,
    currency: 'PEN',
    createdAt: NOW,
    updatedAt: NOW,
    ...change,
  };
}

const at = (km: number) => ({ lat: HOME.lat + km * KM_IN_DEGREES, lng: HOME.lng });

describe('findNearbyDistributors', () => {
  // PLAN 2.6
  it('keeps the distributors whose coverage reaches the point, nearest first', () => {
    const list = [
      distributor('far', { plant: at(4) }),
      distributor('near', { plant: at(1) }),
      distributor('outside', { plant: at(8) }),
    ];

    const nearby = findNearbyDistributors(list, HOME, NOW);

    expect(nearby.map((entry) => entry.distributor.id)).toEqual(['near', 'far']);
    expect(nearby[0]?.distanceKm).toBeCloseTo(1, 1);
  });

  it('uses each distributor own radius', () => {
    const list = [
      distributor('small', { plant: at(3), coverageRadiusKm: 2 }),
      distributor('big', { plant: at(20), coverageRadiusKm: 25 }),
    ];

    const nearby = findNearbyDistributors(list, HOME, NOW);

    expect(nearby.map((entry) => entry.distributor.id)).toEqual(['big']);
  });

  it.each([
    ['suspended', { status: 'suspended' }],
    ['past due', { status: 'pastDue' }],
    ['trial over', { status: 'trial', trialEndsAt: new Date('2026-03-01T00:00:00Z') }],
  ] as const)('hides a distributor that is %s', (_case, change) => {
    expect(findNearbyDistributors([distributor('x', change)], HOME, NOW)).toEqual([]);
  });

  it('shows a distributor on a running trial', () => {
    const onTrial = distributor('t', {
      status: 'trial',
      trialEndsAt: new Date('2026-04-01T00:00:00Z'),
    });
    expect(findNearbyDistributors([onTrial], HOME, NOW)).toHaveLength(1);
  });

  it('returns nothing for an invalid point or an empty list', () => {
    expect(findNearbyDistributors([distributor('a')], { lat: 200, lng: 0 }, NOW)).toEqual([]);
    expect(findNearbyDistributors([], HOME, NOW)).toEqual([]);
  });
});
