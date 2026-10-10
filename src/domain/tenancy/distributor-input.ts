import { type GeoPoint, isValidGeoPoint } from '../geo/distance';
import {
  ADDRESS_LINE_MAX_LENGTH,
  BRAND_NAME_MAX_LENGTH,
  DEFAULT_BRAND_COLOR,
  DEFAULT_COVERAGE_RADIUS_KM,
  DISPLAY_NAME_MAX_LENGTH,
  DISTRIBUTOR_NAME_MAX_LENGTH,
  DISTRIBUTOR_NAME_MIN_LENGTH,
  MAX_BRANDS,
  MAX_COVERAGE_RADIUS_KM,
  MAX_CYLINDERS_PER_ORDER_LIMIT,
  MAX_PRICE_CENTS,
  MIN_COVERAGE_RADIUS_KM,
  MIN_CYLINDERS_PER_ORDER,
  WEEK_DAYS,
} from './constants';
import {
  isValidBrandColor,
  isValidTimeOfDay,
  normalizeBrandColor,
  normalizePeruvianMobile,
} from './contact';
import {
  type Check,
  checkInteger,
  checkPhone,
  checkRange,
  checkText,
  collectIssues,
  type FieldIssue,
  type Validated,
} from './field-checks';
import { normalizeSlug, validateSlug } from './slug';
import type { Distributor, Schedule } from './types';

/** What the sign-up form collects. Everything else gets a default the owner can edit later. */
export interface NewDistributorInput {
  name: string;
  slug: string;
  contactPhone: string;
  /** Defaults to `contactPhone`. */
  whatsapp?: string;
  addressLine: string;
  plant: GeoPoint;
  coverageRadiusKm?: number;
  brandColor?: string;
  ownerName: string;
  ownerPhone: string;
}

export type NewDistributor = Required<NewDistributorInput>;

/** Fields an owner may edit on the public profile. The rules hold the same whitelist. */
export const EDITABLE_PROFILE_FIELDS = [
  'name',
  'contactPhone',
  'whatsapp',
  'addressLine',
  'plant',
  'coverageRadiusKm',
  'brandColor',
  'schedule',
  'maxCylindersPerOrder',
  'brands',
  'priceFromCents',
] as const satisfies readonly (keyof Distributor)[];

export type DistributorProfilePatch = Partial<
  Pick<Distributor, (typeof EDITABLE_PROFILE_FIELDS)[number]>
>;

function checkSchedule(schedule: Schedule): Check {
  const days = schedule.days;
  const knownDays = days.every((day) => (WEEK_DAYS as readonly number[]).includes(day));
  if (days.length === 0 || days.length > WEEK_DAYS.length || !knownDays) return 'invalid';
  if (new Set(days).size !== days.length) return 'invalid';
  return isValidTimeOfDay(schedule.opensAt) && isValidTimeOfDay(schedule.closesAt)
    ? null
    : 'invalid';
}

function checkBrands(brands: string[]): Check {
  if (brands.length > MAX_BRANDS) return 'tooLong';
  const valid = brands.every((brand) => checkText(brand, 1, BRAND_NAME_MAX_LENGTH) === null);
  return valid ? null : 'invalid';
}

const checkPrice = (priceCents: number | null): Check =>
  priceCents === null ? null : checkInteger(priceCents, 1, MAX_PRICE_CENTS);

const PROFILE_CHECKS: {
  [K in keyof DistributorProfilePatch]-?: (value: NonNullable<Distributor[K]> | null) => Check;
} = {
  name: (v) => checkText(v ?? '', DISTRIBUTOR_NAME_MIN_LENGTH, DISTRIBUTOR_NAME_MAX_LENGTH),
  contactPhone: (v) => checkPhone(v ?? ''),
  whatsapp: (v) => checkPhone(v ?? ''),
  addressLine: (v) => checkText(v ?? '', 0, ADDRESS_LINE_MAX_LENGTH),
  plant: (v) => (v !== null && isValidGeoPoint(v) ? null : 'invalid'),
  coverageRadiusKm: (v) =>
    checkRange(v ?? Number.NaN, MIN_COVERAGE_RADIUS_KM, MAX_COVERAGE_RADIUS_KM),
  brandColor: (v) => (isValidBrandColor(v ?? '') ? null : 'invalid'),
  schedule: (v) => (v === null ? 'invalid' : checkSchedule(v)),
  maxCylindersPerOrder: (v) =>
    checkInteger(v ?? Number.NaN, MIN_CYLINDERS_PER_ORDER, MAX_CYLINDERS_PER_ORDER_LIMIT),
  brands: (v) => (v === null ? 'invalid' : checkBrands(v)),
  priceFromCents: (v) => checkPrice(v),
};

function normalizePatch(patch: DistributorProfilePatch): DistributorProfilePatch {
  const normalized: DistributorProfilePatch = { ...patch };
  if (patch.name !== undefined) normalized.name = patch.name.trim();
  if (patch.addressLine !== undefined) normalized.addressLine = patch.addressLine.trim();
  if (patch.contactPhone !== undefined) {
    normalized.contactPhone = normalizePeruvianMobile(patch.contactPhone);
  }
  if (patch.whatsapp !== undefined) normalized.whatsapp = normalizePeruvianMobile(patch.whatsapp);
  if (patch.brandColor !== undefined) normalized.brandColor = normalizeBrandColor(patch.brandColor);
  if (patch.brands !== undefined) normalized.brands = patch.brands.map((brand) => brand.trim());
  return normalized;
}

/** Normalises and validates an edit of the public profile. Unknown fields are dropped. */
export function prepareProfilePatch(
  patch: DistributorProfilePatch,
): Validated<DistributorProfilePatch> {
  const normalized = normalizePatch(patch);
  const value: Record<string, unknown> = {};
  const issues: FieldIssue[] = [];
  for (const field of EDITABLE_PROFILE_FIELDS) {
    const fieldValue = normalized[field];
    if (fieldValue === undefined) continue;
    const code = (PROFILE_CHECKS[field] as (v: unknown) => Check)(fieldValue);
    if (code) issues.push({ field, code });
    value[field] = fieldValue;
  }
  return issues.length > 0 ? { ok: false, issues } : { ok: true, value };
}

/** Normalises and validates the sign-up form, filling the optional fields with defaults. */
export function prepareNewDistributor(input: NewDistributorInput): Validated<NewDistributor> {
  const contactPhone = normalizePeruvianMobile(input.contactPhone);
  const value: NewDistributor = {
    name: input.name.trim(),
    slug: normalizeSlug(input.slug),
    contactPhone,
    whatsapp: input.whatsapp ? normalizePeruvianMobile(input.whatsapp) : contactPhone,
    addressLine: input.addressLine.trim(),
    plant: input.plant,
    coverageRadiusKm: input.coverageRadiusKm ?? DEFAULT_COVERAGE_RADIUS_KM,
    brandColor: normalizeBrandColor(input.brandColor ?? DEFAULT_BRAND_COLOR),
    ownerName: input.ownerName.trim(),
    ownerPhone: normalizePeruvianMobile(input.ownerPhone),
  };
  const profile = prepareProfilePatch({
    name: value.name,
    contactPhone: value.contactPhone,
    // Without its own number WhatsApp mirrors the contact phone: report that problem once.
    ...(input.whatsapp ? { whatsapp: value.whatsapp } : {}),
    addressLine: value.addressLine,
    plant: value.plant,
    coverageRadiusKm: value.coverageRadiusKm,
    brandColor: value.brandColor,
  });
  const issues: FieldIssue[] = profile.ok ? [] : [...profile.issues];
  issues.push(
    ...collectIssues([
      ['slug', validateSlug(value.slug)],
      ['ownerName', checkText(value.ownerName, 1, DISPLAY_NAME_MAX_LENGTH)],
      ['ownerPhone', checkPhone(value.ownerPhone)],
    ]),
  );
  return issues.length > 0 ? { ok: false, issues } : { ok: true, value };
}
