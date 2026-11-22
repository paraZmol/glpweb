import {
  type DocumentData,
  type FirestoreDataConverter,
  type QueryDocumentSnapshot,
  Timestamp,
} from 'firebase/firestore';
import { defaultProductName, type Product } from '../domain/catalog/product';
import { SALE_MODES } from '../domain/catalog/sale-mode';
import { PROMOTION_TYPES, type Promotion, type PromotionDeal } from '../domain/pricing/promotion';
import type { Helper } from '../domain/staff/helper';
import type { PlantStock } from '../domain/stock/plant-stock';
import {
  ADJUSTMENT_REASONS,
  STOCK_MOVEMENT_KINDS,
  type StockMovement,
} from '../domain/stock/movement';
import { type Vehicle, VEHICLE_KINDS } from '../domain/vehicles/vehicle';
import { INVITE_STATUSES, type Invite } from '../domain/staff/invite';
import { type GeoPoint, isValidGeoPoint } from '../domain/geo/distance';
import {
  ACCEPTED_TEXTS,
  type AcceptanceEntry,
  type LegalAcceptance,
} from '../domain/legal/versions';
import {
  DEFAULT_BRAND_COLOR,
  DEFAULT_COVERAGE_RADIUS_KM,
  DEFAULT_CURRENCY,
  DEFAULT_MAX_CYLINDERS_PER_ORDER,
  DEFAULT_SCHEDULE,
} from '../domain/tenancy/constants';
import { isComplaintsBookUrl } from '../domain/tenancy/complaints-book';
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
  type ReviewNoteDocument,
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

  fail(key: string, expected: string): never {
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

const complaintsBookUrlOrNull = (url: string | null): string | null =>
  url !== null && isComplaintsBookUrl(url) ? url : null;

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

export const parseAcceptanceEntry: Parser<AcceptanceEntry> = (id, path, data) => {
  const read = new FieldReader(path, data);
  return {
    id,
    document: read.oneOf('document', ACCEPTED_TEXTS),
    version: read.text('version'),
    acceptedAt: read.date('acceptedAt'),
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
    // Added on 2026-10-15 (PLAN §11): absent in profiles written before.
    priceFromWeightKg: read.integerOrNull('priceFromWeightKg'),
    // A link is only ever built from a validated address (tracking-pwa §4).
    complaintsBookUrl: complaintsBookUrlOrNull(read.textOrNull('complaintsBookUrl')),
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
    reviewNoteAt: read.dateOrNull('reviewNoteAt'),
    // Only a control document older than PLAN 3.2 kept the text here; it lives in
    // private/review now (`noteTextFor`).
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

export const parseReviewNote: Parser<ReviewNoteDocument> = (_id, path, data) => {
  const read = new FieldReader(path, data);
  return { note: read.text('note'), writtenAt: read.date('writtenAt') };
};

/** `distributorId` is the parent of the parent: the invitation does not repeat it. */
export const parseInvite: Parser<Invite> = (id, path, data) => {
  const read = new FieldReader(path, data);
  const createdAt = read.date('createdAt');
  return {
    id,
    distributorId: path.split('/')[1] ?? '',
    role: read.oneOf('role', MEMBER_ROLES),
    email: read.textOrNull('email'),
    distributorName: read.text('distributorName', ''),
    // Copies added on 2026-10-15 (PLAN §11): an older invitation has neither.
    invitedByName: read.textOrNull('invitedByName'),
    brandColor: read.textOrNull('brandColor'),
    status: read.oneOf('status', INVITE_STATUSES),
    createdBy: read.text('createdBy', ''),
    createdAt,
    updatedAt: read.date('updatedAt', createdAt),
    acceptedBy: read.textOrNull('acceptedBy'),
    acceptedAt: read.dateOrNull('acceptedAt'),
    revokedBy: read.textOrNull('revokedBy'),
    revokedAt: read.dateOrNull('revokedAt'),
  };
};

export const parseHelper: Parser<Helper> = (id, path, data) => {
  const read = new FieldReader(path, data);
  const createdAt = read.date('createdAt');
  return {
    id,
    name: read.text('name'),
    // A helper without the flag is not offered: never send someone who was not added as active.
    active: read.flag('active', false),
    createdAt,
    updatedAt: read.date('updatedAt', createdAt),
  };
};

export const parseProduct: Parser<Product> = (id, path, data) => {
  const read = new FieldReader(path, data);
  const createdAt = read.date('createdAt');
  const weightKg = read.number('weightKg');
  const refillPriceCents = read.integerOrNull('refillPriceCents');
  if (refillPriceCents === null) {
    throw new CorruptDocumentError(path, '"refillPriceCents" should be integer cents');
  }
  return {
    id,
    brand: read.text('brand'),
    brandColor: read.textOrNull('brandColor'),
    weightKg,
    name: read.text('name', defaultProductName(weightKg)),
    refillPriceCents,
    // Anything but integer cents above the refill reads as "not sold with its container".
    fullPriceCents: aboveOrNull(read.integerOrNull('fullPriceCents'), refillPriceCents),
    currency: read.text('currency', DEFAULT_CURRENCY),
    // A product without the flag is not offered: never sell what was not put on sale.
    active: read.flag('active', false),
    sortOrder: read.number('sortOrder', 0),
    // Price lock of PLAN 3.5; absent in products that never had a promotion.
    promotedUntil: read.dateOrNull('promotedUntil'),
    createdAt,
    updatedAt: read.date('updatedAt', createdAt),
  };
};

export const parseVehicle: Parser<Vehicle> = (id, path, data) => {
  const read = new FieldReader(path, data);
  const createdAt = read.date('createdAt');
  return {
    id,
    kind: read.oneOf('kind', VEHICLE_KINDS),
    name: read.text('name'),
    plate: read.textOrNull('plate'),
    capacityCylinders: wholeCount(read, 'capacityCylinders'),
    // A vehicle without the flag is not offered: never send out one that was not added as in use.
    active: read.flag('active', false),
    createdAt,
    updatedAt: read.date('updatedAt', createdAt),
  };
};

export const parsePlantStock: Parser<PlantStock> = (id, path, data) => {
  const read = new FieldReader(path, data);
  return {
    productId: id,
    full: wholeCount(read, 'full'),
    empty: wholeCount(read, 'empty'),
    lastMovementId: read.textOrNull('lastMovementId'),
    updatedAt: read.dateOrNull('updatedAt'),
  };
};

export const parseStockMovement: Parser<StockMovement> = (id, path, data) => {
  const read = new FieldReader(path, data);
  return {
    id,
    kind: read.oneOf('kind', STOCK_MOVEMENT_KINDS),
    productId: read.text('productId'),
    reason: read.oneOf('reason', ADJUSTMENT_REASONS),
    note: read.textOrNull('note'),
    fullDelta: wholeCount(read, 'fullDelta'),
    emptyDelta: wholeCount(read, 'emptyDelta'),
    fullAfter: wholeCount(read, 'fullAfter'),
    emptyAfter: wholeCount(read, 'emptyAfter'),
    authorUid: read.text('authorUid'),
    authorName: read.text('authorName', ''),
    createdAt: read.date('createdAt'),
  };
};

/** Counts of cylinders are whole numbers: anything else is a corrupt document, never rounded. */
function wholeCount(read: FieldReader, key: string): number {
  const value = read.integerOrNull(key);
  return value ?? read.fail(key, 'a whole number');
}

/** The kind and its parameters; anything the rules would not have accepted is corrupt. */
function readDeal(read: FieldReader, path: string, data: DocumentData): PromotionDeal {
  const type = read.oneOf('type', PROMOTION_TYPES);
  const whole = (key: string) => {
    const value = read.integerOrNull(key);
    if (value === null) throw new CorruptDocumentError(path, `"${key}" should be an integer`);
    return value;
  };
  switch (type) {
    case 'fixedPrice':
      return data.priceSource === 'refill'
        ? { type, priceSource: 'refill' }
        : { type, priceSource: 'own', priceCents: whole('priceCents') };
    case 'percentOff':
      return { type, percent: whole('percent') };
    case 'amountOff':
      return { type, amountCents: whole('amountCents') };
    case 'buyXPayY':
      return { type, buyUnits: whole('buyUnits'), payUnits: whole('payUnits') };
  }
}

export const parsePromotion: Parser<Promotion> = (id, path, data) => {
  const read = new FieldReader(path, data);
  const createdAt = read.date('createdAt');
  return {
    id,
    title: read.text('title'),
    deal: readDeal(read, path, data),
    productIds: read.textList('productIds'),
    saleMode: read.oneOf('saleMode', SALE_MODES),
    startsAt: read.date('startsAt'),
    endsAt: read.date('endsAt'),
    // A promotion without the flag is not offered: never apply what was not published.
    active: read.flag('active', false),
    maxUnitsPerOrder: read.number('maxUnitsPerOrder'),
    totalUnits: read.integerOrNull('totalUnits'),
    soldUnits: read.number('soldUnits', 0),
    conditions: read.text('conditions', ''),
    createdBy: read.text('createdBy', ''),
    createdAt,
    updatedAt: read.date('updatedAt', createdAt),
    switchedOffBy: read.textOrNull('switchedOffBy'),
    switchedOffAt: read.dateOrNull('switchedOffAt'),
  };
};

function aboveOrNull(value: number | null, floor: number): number | null {
  return value !== null && value > floor ? value : null;
}

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
export const acceptanceEntryConverter = readOnlyConverter(parseAcceptanceEntry);
export const publicDistributorConverter = readOnlyConverter(parsePublicDistributor);
export const controlConverter = readOnlyConverter(parseControl);
export const privateSettingsConverter = readOnlyConverter(parsePrivateSettings);
export const memberConverter = readOnlyConverter(parseMember);
export const productConverter = readOnlyConverter(parseProduct);
export const reviewNoteConverter = readOnlyConverter(parseReviewNote);
export const inviteConverter = readOnlyConverter(parseInvite);
export const helperConverter = readOnlyConverter(parseHelper);
export const vehicleConverter = readOnlyConverter(parseVehicle);
export const plantStockConverter = readOnlyConverter(parsePlantStock);
export const stockMovementConverter = readOnlyConverter(parseStockMovement);
export const promotionConverter = readOnlyConverter(parsePromotion);
