import type { GeoPoint } from '../geo/distance';

export const DISTRIBUTOR_STATUSES = ['trial', 'active', 'pastDue', 'suspended'] as const;
export type DistributorStatus = (typeof DISTRIBUTOR_STATUSES)[number];

/** Statuses the public search may list. An expired trial is filtered out with `isWritable`. */
export const VISIBLE_DISTRIBUTOR_STATUSES = [
  'trial',
  'active',
] as const satisfies readonly DistributorStatus[];

export const MEMBER_ROLES = ['owner', 'dispatcher', 'driver'] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

/** Roles that manage the office side (orders board, staff list). */
export const OFFICE_ROLES = ['owner', 'dispatcher'] as const satisfies readonly MemberRole[];

/** Opening hours: the same window on every listed day. `days` uses 0 = Sunday … 6 = Saturday. */
export interface Schedule {
  days: number[];
  opensAt: string;
  closesAt: string;
}

/**
 * Public document `/distributors/{d}`: anyone can read every field, signed in or not.
 * Nothing about the owner as a person belongs here (see `DistributorPrivateSettings`).
 */
export interface Distributor {
  id: string;
  name: string;
  slug: string;
  /** Opaque account id of the founder; immutable. */
  ownerUid: string;
  contactPhone: string;
  whatsapp: string;
  addressLine: string;
  plant: GeoPoint;
  coverageRadiusKm: number;
  brandColor: string;
  status: DistributorStatus;
  trialEndsAt: Date;
  schedule: Schedule;
  maxCylindersPerOrder: number;
  /** Denormalised from the catalogue for the search page. */
  brands: string[];
  /** Cheapest active product, for "desde S/ …" in the search page; null until there is a catalogue. */
  priceFromCents: number | null;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
}

export const DISTRIBUTOR_PLANS = ['trial'] as const;
export type DistributorPlan = (typeof DISTRIBUTOR_PLANS)[number];

/** Private document `/distributors/{d}/private/settings`: founder, owners and platform admins. */
export interface DistributorPrivateSettings {
  ownerUid: string;
  ownerName: string;
  ownerPhone: string;
  ownerEmail: string;
  plan: DistributorPlan;
  createdAt: Date;
  updatedAt: Date;
}

export interface Member {
  uid: string;
  distributorId: string;
  role: MemberRole;
  active: boolean;
  displayName: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  phone: string | null;
  /** Maintained by the creation batch and checked by the rules; caps distributors per account. */
  ownedDistributorIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Address {
  id: string;
  label: string;
  addressLine: string;
  reference: string;
  location: GeoPoint;
  createdAt: Date;
  updatedAt: Date;
}
