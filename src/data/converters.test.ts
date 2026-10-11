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
  parseControl,
  parsePublicDistributor,
  parseMember,
  parsePrivateSettings,
  parseUserProfile,
} from './converters';

const AT = new Date('2026-03-10T15:00:00Z');
const stamp = Timestamp.fromDate(AT);

const MINIMAL_DISTRIBUTOR = {
  name: 'Gas Demo A',
  slug: 'gas-demo-a',
  contactPhone: '900000001',
  plant: { lat: -12.0464, lng: -77.0428 },
  acceptingOrders: true,
  createdAt: stamp,
};

describe('parsePublicDistributor', () => {
  it('reads a full document', () => {
    const distributor = parsePublicDistributor('dist-a', 'distributors/dist-a', {
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
      acceptingOrders: true,
    });
  });

  it('fills defaults for fields that were added after the document was written', () => {
    const distributor = parsePublicDistributor(
      'dist-a',
      'distributors/dist-a',
      MINIMAL_DISTRIBUTOR,
    );

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
    ['a plant off the globe', { plant: { lat: 120, lng: 0 } }],
    ['a plant as text', { plant: '-12,-77' }],
    ['no createdAt', { createdAt: null }],
  ])('rejects %s instead of guessing', (_case, change) => {
    const data = { ...MINIMAL_DISTRIBUTOR, ...change };
    expect(() => parsePublicDistributor('dist-a', 'distributors/dist-a', data)).toThrow(
      CorruptDocumentError,
    );
  });

  // PLAN 2.9: the public profile carries no plan, trial date or account id.
  it('never returns the control fields, even from a document that still has them', () => {
    const legacy = { ...MINIMAL_DISTRIBUTOR, ownerUid: 'owner-a', status: 'pastDue' };
    const distributor = parsePublicDistributor('dist-a', 'distributors/dist-a', {
      ...legacy,
      trialEndsAt: stamp,
    });

    expect(Object.keys(distributor)).not.toEqual(
      expect.arrayContaining(['ownerUid', 'status', 'trialEndsAt']),
    );
    expect(distributor).not.toHaveProperty('ownerUid');
    expect(distributor).not.toHaveProperty('status');
    expect(distributor).not.toHaveProperty('trialEndsAt');
  });

  it('does not list a document written before the acceptingOrders flag existed', () => {
    const { acceptingOrders: _dropped, ...older } = MINIMAL_DISTRIBUTOR;

    expect(parsePublicDistributor('dist-a', 'distributors/dist-a', older).acceptingOrders).toBe(
      false,
    );
  });

  it('drops list items and prices of the wrong type', () => {
    const data = { ...MINIMAL_DISTRIBUTOR, brands: ['Marca Uno', 7, null], priceFromCents: 38.5 };
    const distributor = parsePublicDistributor('dist-a', 'distributors/dist-a', data);

    expect(distributor.brands).toEqual(['Marca Uno']);
    expect(distributor.priceFromCents).toBeNull();
  });
});

describe('parseControl', () => {
  const CONTROL = { ownerUid: 'owner-a', status: 'trial', trialEndsAt: stamp, createdAt: stamp };
  const path = 'distributors/dist-a/private/control';

  it('reads the plan state of a distributor, not approved when the document predates it', () => {
    expect(parseControl('control', path, CONTROL)).toEqual({
      ownerUid: 'owner-a',
      status: 'trial',
      trialEndsAt: AT,
      listingApproved: false,
      approvedAt: null,
      approvedBy: null,
      reviewNote: null,
      correctedAt: null,
      distributorName: null,
      slug: null,
      createdAt: AT,
      updatedAt: AT,
    });
  });

  // PLAN 2.11
  it('reads the copies of the public name and link, and the correction mark', () => {
    const full = {
      ...CONTROL,
      reviewNote: 'Falta el registro.',
      correctedAt: stamp,
      distributorName: 'Gas Demo',
      slug: 'gas-demo',
    };

    expect(parseControl('control', path, full)).toMatchObject({
      correctedAt: AT,
      distributorName: 'Gas Demo',
      slug: 'gas-demo',
    });
  });

  it('reads a correction mark that is not a timestamp as none', () => {
    const forged = { ...CONTROL, reviewNote: 'x', correctedAt: '2026-10-11' };

    expect(parseControl('control', path, forged).correctedAt).toBeNull();
  });

  // PLAN 2.11
  it('reads an approval with its signature', () => {
    const approved = { ...CONTROL, listingApproved: true, approvedAt: stamp, approvedBy: 'admin' };

    expect(parseControl('control', path, approved)).toMatchObject({
      listingApproved: true,
      approvedAt: AT,
      approvedBy: 'admin',
      reviewNote: null,
    });
  });

  it('reads the note of a listing that was sent back', () => {
    const sentBack = { ...CONTROL, listingApproved: false, reviewNote: 'Falta el registro.' };

    expect(parseControl('control', path, sentBack)).toMatchObject({
      listingApproved: false,
      reviewNote: 'Falta el registro.',
    });
  });

  it.each([
    ['text', 'true'],
    ['a number', 1],
    ['null', null],
  ])('never reads an approval written as %s as approved', (_case, listingApproved) => {
    expect(parseControl('control', path, { ...CONTROL, listingApproved }).listingApproved).toBe(
      false,
    );
  });

  it.each([
    ['an unknown status', { status: 'vip' }],
    ['trialEndsAt as text', { trialEndsAt: '2026-01-01' }],
    ['no founder', { ownerUid: undefined }],
  ])('rejects %s instead of guessing', (_case, change) => {
    expect(() => parseControl('control', path, { ...CONTROL, ...change })).toThrow(
      CorruptDocumentError,
    );
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
      distributorName: '',
    });
  });

  it('reads the copy of the distributor name', () => {
    const named = { ...MEMBER, distributorName: 'Gas Demo A' };

    expect(parseMember('driver-a', 'p', named).distributorName).toBe('Gas Demo A');
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
      terms: null,
      privacy: null,
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

describe('parsePrivateSettings — verification data (PLAN 2.11)', () => {
  const SETTINGS = { ownerUid: 'owner-a', createdAt: stamp };

  it('reads the RUC, the legal name and the record number', () => {
    const settings = parsePrivateSettings('settings', 'p', {
      ...SETTINGS,
      taxId: '20000000001',
      legalName: 'Gas Demo A S.A.C.',
      hydrocarbonsRegistry: '00000-074-000000',
    });

    expect(settings).toMatchObject({
      taxId: '20000000001',
      legalName: 'Gas Demo A S.A.C.',
      hydrocarbonsRegistry: '00000-074-000000',
    });
  });

  it('reads them as empty in a document older than the fields', () => {
    expect(parsePrivateSettings('settings', 'p', SETTINGS)).toMatchObject({
      taxId: '',
      legalName: '',
      hydrocarbonsRegistry: '',
    });
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

    expect(settings).toMatchObject({
      ownerUid: 'owner-a',
      plan: 'trial',
      terms: null,
      authorityDeclaredAt: null,
    });
  });

  it('reads the acceptance of the terms and the authority declaration', () => {
    const settings = parsePrivateSettings('settings', 'p', {
      ownerUid: 'owner-a',
      terms: { version: '0.1', acceptedAt: stamp },
      authorityDeclaredAt: stamp,
      createdAt: stamp,
    });

    expect(settings.terms).toEqual({ version: '0.1', acceptedAt: AT });
    expect(settings.authorityDeclaredAt).toEqual(AT);
  });

  it('ignores a malformed acceptance instead of trusting it', () => {
    const settings = parsePrivateSettings('settings', 'p', {
      ownerUid: 'owner-a',
      terms: { version: 1, acceptedAt: 'ayer' },
      createdAt: stamp,
    });

    expect(settings.terms).toBeNull();
  });
});
