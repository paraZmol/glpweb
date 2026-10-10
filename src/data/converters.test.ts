import { Timestamp } from 'firebase/firestore';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BRAND_COLOR,
  DEFAULT_COVERAGE_RADIUS_KM,
  DEFAULT_MAX_CYLINDERS_PER_ORDER,
  DEFAULT_SCHEDULE,
} from '../domain/tenancy/constants';
import { CorruptDocumentError } from '../domain/tenancy/errors';
import {
  parseAddress,
  parseDistributor,
  parseMember,
  parsePrivateSettings,
  parseUserProfile,
} from './converters';

const AT = new Date('2026-03-10T15:00:00Z');
const stamp = Timestamp.fromDate(AT);

const MINIMAL_DISTRIBUTOR = {
  name: 'Gas Demo A',
  slug: 'gas-demo-a',
  ownerUid: 'owner-a',
  contactPhone: '900000001',
  plant: { lat: -12.0464, lng: -77.0428 },
  status: 'active',
  trialEndsAt: stamp,
  createdAt: stamp,
};

describe('parseDistributor', () => {
  it('reads a full document', () => {
    const distributor = parseDistributor('dist-a', 'distributors/dist-a', {
      ...MINIMAL_DISTRIBUTOR,
      whatsapp: '900000002',
      addressLine: 'Av. Principal 100',
      coverageRadiusKm: 8,
      brandColor: '#0a7cff',
      schedule: { days: [1, 2], opensAt: '08:00', closesAt: '18:00' },
      maxCylindersPerOrder: 5,
      brands: ['Marca Uno'],
      priceFromCents: 3800,
      currency: 'PEN',
      updatedAt: stamp,
    });

    expect(distributor).toMatchObject({
      id: 'dist-a',
      whatsapp: '900000002',
      coverageRadiusKm: 8,
      schedule: { days: [1, 2], opensAt: '08:00', closesAt: '18:00' },
      brands: ['Marca Uno'],
      priceFromCents: 3800,
      trialEndsAt: AT,
    });
  });

  it('fills defaults for fields that were added after the document was written', () => {
    const distributor = parseDistributor('dist-a', 'distributors/dist-a', MINIMAL_DISTRIBUTOR);

    expect(distributor).toMatchObject({
      whatsapp: '900000001',
      addressLine: '',
      coverageRadiusKm: DEFAULT_COVERAGE_RADIUS_KM,
      brandColor: DEFAULT_BRAND_COLOR,
      schedule: DEFAULT_SCHEDULE,
      maxCylindersPerOrder: DEFAULT_MAX_CYLINDERS_PER_ORDER,
      brands: [],
      priceFromCents: null,
      currency: 'PEN',
      updatedAt: AT,
    });
  });

  it.each([
    ['a missing name', { name: undefined }],
    ['a numeric slug', { slug: 5 }],
    ['an unknown status', { status: 'vip' }],
    ['a plant off the globe', { plant: { lat: 120, lng: 0 } }],
    ['a plant as text', { plant: '-12,-77' }],
    ['trialEndsAt as text', { trialEndsAt: '2026-01-01' }],
    ['no createdAt', { createdAt: null }],
  ])('rejects %s instead of guessing', (_case, change) => {
    const data = { ...MINIMAL_DISTRIBUTOR, ...change };
    expect(() => parseDistributor('dist-a', 'distributors/dist-a', data)).toThrow(
      CorruptDocumentError,
    );
  });

  it('drops list items and prices of the wrong type', () => {
    const data = { ...MINIMAL_DISTRIBUTOR, brands: ['Marca Uno', 7, null], priceFromCents: 38.5 };
    const distributor = parseDistributor('dist-a', 'distributors/dist-a', data);

    expect(distributor.brands).toEqual(['Marca Uno']);
    expect(distributor.priceFromCents).toBeNull();
  });
});

describe('parseMember', () => {
  const MEMBER = { distributorId: 'dist-a', role: 'driver', active: true, createdAt: stamp };

  it('reads a member and takes the uid from the document id', () => {
    const member = parseMember('driver-a', 'distributors/dist-a/members/driver-a', MEMBER);
    expect(member).toMatchObject({
      uid: 'driver-a',
      role: 'driver',
      active: true,
      displayName: '',
    });
  });

  it('treats a member without the active flag as inactive', () => {
    const { active: _dropped, ...withoutFlag } = MEMBER;
    expect(parseMember('driver-a', 'p', withoutFlag).active).toBe(false);
  });

  it('rejects an unknown role', () => {
    expect(() => parseMember('x', 'p', { ...MEMBER, role: 'admin' })).toThrow(CorruptDocumentError);
  });
});

describe('parseUserProfile', () => {
  it('reads a profile and normalises an empty phone to null', () => {
    const profile = parseUserProfile('u1', 'users/u1', {
      displayName: 'C. Cliente',
      phone: '',
      createdAt: stamp,
      updatedAt: stamp,
    });

    expect(profile).toEqual({
      uid: 'u1',
      displayName: 'C. Cliente',
      phone: null,
      ownedDistributorIds: [],
      createdAt: AT,
      updatedAt: AT,
    });
  });

  it('rejects a profile without a name', () => {
    expect(() => parseUserProfile('u1', 'users/u1', { createdAt: stamp })).toThrow(
      CorruptDocumentError,
    );
  });
});

describe('parseAddress', () => {
  const ADDRESS = {
    label: 'Casa',
    addressLine: 'Calle Uno 123',
    location: { lat: -12.0464, lng: -77.0428 },
    createdAt: stamp,
  };

  it('reads an address and defaults the reference', () => {
    expect(parseAddress('a0', 'users/u1/addresses/a0', ADDRESS)).toMatchObject({
      id: 'a0',
      reference: '',
      location: ADDRESS.location,
    });
  });

  it('rejects an address without a valid point', () => {
    const broken = { ...ADDRESS, location: { lat: 0 } };
    expect(() => parseAddress('a0', 'p', broken)).toThrow(CorruptDocumentError);
  });
});

describe('parsePrivateSettings', () => {
  it('reads the settings and falls back to the trial plan for an unknown one', () => {
    const settings = parsePrivateSettings('settings', 'p', {
      ownerUid: 'owner-a',
      ownerName: 'A. Dueña',
      ownerPhone: '900000002',
      ownerEmail: 'owner-a@example.com',
      plan: 'something-new',
      createdAt: stamp,
    });

    expect(settings).toMatchObject({ ownerUid: 'owner-a', plan: 'trial' });
  });
});
