import type { GeoPoint } from '../geo/distance';
import type { LegalAcceptance } from '../legal/versions';

export const DISTRIBUTOR_STATUSES = ['trial', 'active', 'pastDue', 'suspended'] as const;
export type DistributorStatus = (typeof DISTRIBUTOR_STATUSES)[number];

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
 * Public document `/distributors/{d}`: while it takes orders anyone can read every field,
 * signed in or not, so it holds only what a customer needs to find the business and order from
 * it. Nothing about the plan, the trial or the founder lives here (PLAN 2.9): see
 * `DistributorControl`. While it does not take orders (not approved yet, suspended, trial over)
 * only its staff and platform admins can read it (PLAN 2.11).
 */
export interface PublicDistributor {
  id: string;
  name: string;
  slug: string;
  contactPhone: string;
  whatsapp: string;
  addressLine: string;
  plant: GeoPoint;
  coverageRadiusKm: number;
  brandColor: string;
  /**
   * Whether the distributor takes orders: it may operate and its listing was approved (see
   * `isOpenToPublic`). Derived from the control document by whoever changes it; it can lag
   * behind an expired trial until the staff or a platform admin opens the panel.
   * The security rules never trust it: they read the control document.
   */
  acceptingOrders: boolean;
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

/**
 * Control document `/distributors/{d}/private/control`: where the distributor stands with the
 * platform. Readable by its staff and by platform admins only; the security rules read it to
 * decide whether the distributor is writable.
 */
export interface DistributorControl {
  /** Opaque account id of the founder; immutable. */
  ownerUid: string;
  status: DistributorStatus;
  trialEndsAt: Date;
  /**
   * Whether a platform admin approved showing this distributor to the public (PLAN 2.11). False
   * from the founding until the approval, and again whenever the owner changes the name or a
   * phone. Only a platform admin sets it to true. False in documents older than the field.
   */
  listingApproved: boolean;
  /** When and by which platform admin it was approved; null while it is not. */
  approvedAt: Date | null;
  approvedBy: string | null;
  /** What the platform admin asks the owner to correct; null when there is no note. */
  reviewNote: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** The distributor as its own staff sees it: the public profile plus its control data. */
export interface Distributor extends PublicDistributor {
  ownerUid: string;
  status: DistributorStatus;
  trialEndsAt: Date;
  listingApproved: boolean;
  reviewNote: string | null;
}

export const DISTRIBUTOR_PLANS = ['trial'] as const;
export type DistributorPlan = (typeof DISTRIBUTOR_PLANS)[number];

/**
 * Private document `/distributors/{d}/private/settings`: the founder and platform admins only
 * (not even a co-owner: it holds the founder's own contact data and the tax number).
 */
export interface DistributorPrivateSettings {
  ownerUid: string;
  ownerName: string;
  ownerPhone: string;
  ownerEmail: string;
  plan: DistributorPlan;
  /**
   * Business verification data declared at founding (PLAN 2.11): RUC, registered name and record
   * number in the Registro de Hidrocarburos. Empty in documents older than the fields.
   */
  taxId: string;
  legalName: string;
  hydrocarbonsRegistry: string;
  /** The founder accepted the terms when founding. Null only in documents older than the field. */
  terms: LegalAcceptance | null;
  /** When the founder declared it may represent the business and that it may sell GLP. */
  authorityDeclaredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Member {
  uid: string;
  distributorId: string;
  role: MemberRole;
  active: boolean;
  displayName: string;
  /**
   * Name of the distributor, copied here so the selector needs no extra read (PLAN 2.9). Empty
   * in a document older than the field.
   */
  distributorName: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  phone: string | null;
  /** Maintained by the creation batch and checked by the rules; caps distributors per account. */
  ownedDistributorIds: string[];
  /** Null only in documents older than the field: check with `needsTermsAcceptance`. */
  terms: LegalAcceptance | null;
  /** Acceptance of the privacy policy; null only in documents older than the field. */
  privacy: LegalAcceptance | null;
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
