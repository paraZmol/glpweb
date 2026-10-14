import type { Session } from '../../src/domain/auth/session';
import { PRIVACY_VERSION, TERMS_VERSION } from '../../src/domain/legal/versions';
import type {
  Distributor,
  Member,
  MemberRole,
  PublicDistributor,
  UserProfile,
} from '../../src/domain/tenancy/types';
import type { AccountGateValue } from '../../src/features/account/account-context';
import type { CurrentDistributor } from '../../src/features/tenancy/use-current-distributor';

// Invented data: the repository is public.
const NOW = new Date('2026-10-10T15:00:00Z');
const IN_TWELVE_DAYS = new Date('2026-10-22T15:00:00Z');
const reload = () => {};

export const SESSION: Session = {
  uid: 'u-demo',
  email: 'persona@example.com',
  emailVerified: true,
  displayName: 'Persona Demo',
  providerIds: ['google.com'],
};

export const PROFILE: UserProfile = {
  uid: SESSION.uid,
  displayName: 'Persona Demo',
  phone: null,
  ownedDistributorIds: [],
  terms: { version: TERMS_VERSION, acceptedAt: NOW },
  privacy: { version: PRIVACY_VERSION, acceptedAt: NOW },
  createdAt: NOW,
  updatedAt: NOW,
};

export function distributorOf(id: string, patch: Partial<Distributor> = {}): Distributor {
  return {
    id,
    name: 'Gas Demo Norte',
    slug: 'gas-demo-norte',
    ownerUid: SESSION.uid,
    contactPhone: '900000011',
    whatsapp: '900000011',
    addressLine: 'Av. Demo 123',
    plant: { lat: -12.05, lng: -77.04 },
    coverageRadiusKm: 5,
    brandColor: '#e11d48',
    acceptingOrders: true,
    status: 'trial',
    trialEndsAt: IN_TWELVE_DAYS,
    listingApproved: true,
    reviewNote: null,
    correctedAt: null,
    schedule: { days: [1, 2, 3, 4, 5, 6], opensAt: '07:00', closesAt: '20:00' },
    maxCylindersPerOrder: 3,
    brands: [],
    priceFromCents: null,
    currency: 'PEN',
    createdAt: NOW,
    updatedAt: NOW,
    ...patch,
  };
}

/** The distributor as a visitor reads it: the public profile, nothing about its plan. */
export function publicDistributorOf(patch: Partial<PublicDistributor> = {}): PublicDistributor {
  const {
    ownerUid: _ownerUid,
    status: _status,
    trialEndsAt: _trialEndsAt,
    listingApproved: _listingApproved,
    reviewNote: _reviewNote,
    correctedAt: _correctedAt,
    ...shown
  } = distributorOf('d-norte');
  return { ...shown, ...patch };
}

export function memberOf(role: MemberRole, distributorId = 'd-norte'): Member {
  return {
    uid: SESSION.uid,
    distributorId,
    role,
    active: true,
    displayName: PROFILE.displayName,
    distributorName: 'Gas Demo Norte',
    createdAt: NOW,
    updatedAt: NOW,
  };
}

/** The account works at one distributor (or at several: the first one is the selected one). */
export function workingAs(
  memberships: Member[],
  distributor: Partial<Distributor> = {},
): CurrentDistributor {
  const [membership] = memberships;
  if (!membership) return { status: 'none', memberships: [], reload };
  return {
    status: 'ready',
    memberships,
    membership,
    distributor: distributorOf(membership.distributorId, distributor),
    isWritable: true,
    listing: 'listed',
    select: () => {},
    reload,
  };
}

/** A verified customer with the terms accepted; `patch` turns it into any other account. */
export function accountOf(patch: Partial<AccountGateValue> = {}): AccountGateValue {
  return {
    session: { status: 'signedIn', session: SESSION },
    profile: { status: 'ready', data: { profile: PROFILE, needsTermsAcceptance: false }, reload },
    current: { status: 'none', memberships: [], reload },
    platformAdmin: { status: 'ready', data: false, reload },
    ...patch,
  };
}
