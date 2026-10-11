import {
  type DocumentData,
  type FirestoreDataConverter,
  type QueryDocumentSnapshot,
  Timestamp,
} from 'firebase/firestore';
import { type GeoPoint, isValidGeoPoint } from '../domain/geo/distance';
import type { LegalAcceptance } from '../domain/legal/versions';
import {
  DEFAULT_BRAND_COLOR,
  DEFAULT_COVERAGE_RADIUS_KM,
  DEFAULT_CURRENCY,
  DEFAULT_MAX_CYLINDERS_PER_ORDER,
  DEFAULT_SCHEDULE,
} from '../domain/tenancy/constants';
import { CorruptDocumentError } from '../domain/tenancy/errors';
import {
  type Address,
  DISTRIBUTOR_PLANS,
  DISTRIBUTOR_STATUSES,
  type DistributorControl,
  type DistributorPrivateSettings,
  type Member,
  MEMBER_ROLES,
  type PublicDistributor,
  type Schedule,
  type UserProfile,
} from '../domain/tenancy/types';

/**
 * Typed access to one stored document. A required field that is missing or of the wrong type
 * raises `CorruptDocumentError`; a field with a fallback returns it instead (rule 10 in
 * CLAUDE.md: fields added later are optional or have a default when read).
 */
export class FieldReader {
  constructor(
    private readonly path: string,
    private readonly data: DocumentData,
  ) {}

  private fail(key: string, expected: string): never {
    throw new CorruptDocumentError(this.path, `"${key}" should be ${expected}`);
  }

  private pick<T>(
    key: string,
    expected: string,
    accept: (value: unknown) => T | undefined,
    fallback?: T,
  ): T {
    const value = accept(this.data[key]);
    if (value !== undefined) return value;
    return fallback !== undefined ? fallback : this.fail(key, expected);
  }

  text(key: string, fallback?: string): string {
    return this.pick(key, 'a string', (v) => (typeof v === 'string' ? v : undefined), fallback);
  }

  textOrNull(key: string): string | null {
    const value: unknown = this.data[key];
    return typeof value === 'string' && value !== '' ? value : null;
  }

  number(key: string, fallback?: number): number {
    const accept = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
    return this.pick(key, 'a number', accept, fallback);
  }

  integerOrNull(key: string): number | null {
    const value: unknown = this.data[key];
    return typeof value === 'number' && Number.isInteger(value) ? value : null;
  }

  flag(key: string, fallback?: boolean): boolean {
    return this.pick(key, 'a boolean', (v) => (typeof v === 'boolean' ? v : undefined), fallback);
  }

  date(key: string, fallback?: Date): Date {
    const accept = (v: unknown) => (v instanceof Timestamp ? v.toDate() : undefined);
    return this.pick(key, 'a timestamp', accept, fallback);
  }

  oneOf<T extends string>(key: string, allowed: readonly T[], fallback?: T): T {
    const accept = (v: unknown) => allowed.find((candidate) => candidate === v);
    return this.pick(key, `one of ${allowed.join(' | ')}`, accept, fallback);
  }

  textList(key: string): string[] {
    const value: unknown = this.data[key];
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is string => typeof item === 'string');
  }

  dateOrNull(key: string): Date | null {
    const value: unknown = this.data[key];
    return value instanceof Timestamp ? value.toDate() : null;
  }

  /** A malformed acceptance reads as none: the account is simply asked again. */
  acceptance(key: string): LegalAcceptance | null {
    const value: unknown = this.data[key];
    if (typeof value !== 'object' || value === null) return null;
    const { version, acceptedAt } = value as Record<string, unknown>;
    if (typeof version !== 'string' || !(acceptedAt instanceof Timestamp)) return null;
    return { version, acceptedAt: acceptedAt.toDate() };
  }

  geoPoint(key: string): GeoPoint {
    return this.pick(key, 'a { lat, lng } point', toGeoPoint);
  }

  schedule(key: string): Schedule {
    return toSchedule(this.data[key]) ?? { ...DEFAULT_SCHEDULE, days: [...DEFAULT_SCHEDULE.days] };
  }
}

function toGeoPoint(value: unknown): GeoPoint | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const { lat, lng } = value as Record<string, unknown>;
  if (typeof lat !== 'number' || typeof lng !== 'number') return undefined;
  return isValidGeoPoint({ lat, lng }) ? { lat, lng } : undefined;
}

function toSchedule(value: unknown): Schedule | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const { days, opensAt, closesAt } = value as Record<string, unknown>;
  if (!Array.isArray(days) || typeof opensAt !== 'string' || typeof closesAt !== 'string') {
    return undefined;
  }
  return { days: days.filter((day) => typeof day === 'number'), opensAt, closesAt };
}

type Parser<T> = (id: string, path: string, data: DocumentData) => T;

export const parseUserProfile: Parser<UserProfile> = (id, path, data) => {
  const read = new FieldReader(path, data);
  const createdAt = read.date('createdAt');
  return {
    uid: id,
    displayName: read.text('displayName'),
    phone: read.textOrNull('phone'),
    ownedDistributorIds: read.textList('ownedDistributorIds'),
    terms: read.acceptance('terms'),
    privacy: read.acceptance('privacy'),
    createdAt,
    updatedAt: read.date('updatedAt', createdAt),
  };
};

export const parseAddress: Parser<Address> = (id, path, data) => {
  const read = new FieldReader(path, data);
  const createdAt = read.date('createdAt');
  return {
    id,
    label: read.text('label'),
    addressLine: read.text('addressLine'),
    reference: read.text('reference', ''),
    location: read.geoPoint('location'),
    createdAt,
    updatedAt: read.date('updatedAt', createdAt),
  };
};

export const parsePublicDistributor: Parser<PublicDistributor> = (id, path, data) => {
  const read = new FieldReader(path, data);
  const createdAt = read.date('createdAt');
  const contactPhone = read.text('contactPhone');
  return {
    id,
    name: read.text('name'),
    slug: read.text('slug'),
    contactPhone,
    whatsapp: read.text('whatsapp', contactPhone),
    addressLine: read.text('addressLine', ''),
    plant: read.geoPoint('plant'),
    coverageRadiusKm: read.number('coverageRadiusKm', DEFAULT_COVERAGE_RADIUS_KM),
    brandColor: read.text('brandColor', DEFAULT_BRAND_COLOR),
    // A document older than the flag is not listed until somebody with the right to do so
    // derives it from the control document.
    acceptingOrders: read.flag('acceptingOrders', false),
    schedule: read.schedule('schedule'),
    maxCylindersPerOrder: read.number('maxCylindersPerOrder', DEFAULT_MAX_CYLINDERS_PER_ORDER),
    brands: read.textList('brands'),
    priceFromCents: read.integerOrNull('priceFromCents'),
    currency: read.text('currency', DEFAULT_CURRENCY),
    createdAt,
    updatedAt: read.date('updatedAt', createdAt),
  };
};

export const parseControl: Parser<DistributorControl> = (_id, path, data) => {
  const read = new FieldReader(path, data);
  const createdAt = read.date('createdAt');
  return {
    ownerUid: read.text('ownerUid'),
    status: read.oneOf('status', DISTRIBUTOR_STATUSES),
    trialEndsAt: read.date('trialEndsAt'),
    // A document older than the approval was never approved: it is not shown until it is.
    listingApproved: read.flag('listingApproved', false),
    approvedAt: read.dateOrNull('approvedAt'),
    approvedBy: read.textOrNull('approvedBy'),
    reviewNote: read.textOrNull('reviewNote'),
    correctedAt: read.dateOrNull('correctedAt'),
    distributorName: read.textOrNull('distributorName'),
    slug: read.textOrNull('slug'),
    createdAt,
    updatedAt: read.date('updatedAt', createdAt),
  };
};

export const parsePrivateSettings: Parser<DistributorPrivateSettings> = (_id, path, data) => {
  const read = new FieldReader(path, data);
  const createdAt = read.date('createdAt');
  return {
    ownerUid: read.text('ownerUid'),
    ownerName: read.text('ownerName', ''),
    ownerPhone: read.text('ownerPhone', ''),
    ownerEmail: read.text('ownerEmail', ''),
    plan: read.oneOf('plan', DISTRIBUTOR_PLANS, 'trial'),
    taxId: read.text('taxId', ''),
    legalName: read.text('legalName', ''),
    hydrocarbonsRegistry: read.text('hydrocarbonsRegistry', ''),
    terms: read.acceptance('terms'),
    authorityDeclaredAt: read.dateOrNull('authorityDeclaredAt'),
    createdAt,
    updatedAt: read.date('updatedAt', createdAt),
  };
};

export const parseMember: Parser<Member> = (id, path, data) => {
  const read = new FieldReader(path, data);
  const createdAt = read.date('createdAt');
  return {
    uid: id,
    distributorId: read.text('distributorId'),
    role: read.oneOf('role', MEMBER_ROLES),
    // A member without the flag predates it; never assume access that was not granted.
    active: read.flag('active', false),
    displayName: read.text('displayName', ''),
    distributorName: read.text('distributorName', ''),
    createdAt,
    updatedAt: read.date('updatedAt', createdAt),
  };
};

/**
 * Converters validate what is read. Writes do not go through them: each repository builds the
 * exact document the rules expect (server timestamps, whitelisted fields).
 */
function readOnlyConverter<T>(parse: Parser<T>): FirestoreDataConverter<T> {
  return {
    toFirestore(): DocumentData {
      throw new Error('Read-only converter: writes are built by the repository');
    },
    fromFirestore(snapshot: QueryDocumentSnapshot): T {
      // A pending serverTimestamp() reads as null from the local cache; estimate it instead.
      const data = snapshot.data({ serverTimestamps: 'estimate' });
      return parse(snapshot.id, snapshot.ref.path, data);
    },
  };
}

export const userProfileConverter = readOnlyConverter(parseUserProfile);
export const addressConverter = readOnlyConverter(parseAddress);
export const publicDistributorConverter = readOnlyConverter(parsePublicDistributor);
export const controlConverter = readOnlyConverter(parseControl);
export const privateSettingsConverter = readOnlyConverter(parsePrivateSettings);
export const memberConverter = readOnlyConverter(parseMember);
