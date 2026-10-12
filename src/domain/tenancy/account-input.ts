import { type GeoPoint, isValidGeoPoint } from '../geo/distance';
import {
  ADDRESS_LABEL_MAX_LENGTH,
  ADDRESS_LINE_MAX_LENGTH,
  ADDRESS_REFERENCE_MAX_LENGTH,
  DISPLAY_NAME_MAX_LENGTH,
  MAX_ADDRESSES_PER_USER,
} from './constants';
import { normalizePeruvianMobile } from './contact';
import { checkPhone, checkText, collectIssues, type Validated } from './field-checks';

export interface UserProfileInput {
  displayName: string;
  /** Empty or missing means "no phone yet". */
  phone?: string | null;
}

export interface PreparedUserProfile {
  displayName: string;
  phone: string | null;
}

export function prepareUserProfile(input: UserProfileInput): Validated<PreparedUserProfile> {
  const displayName = input.displayName.trim();
  const phone = input.phone ? normalizePeruvianMobile(input.phone) : null;
  const issues = collectIssues([
    ['displayName', checkText(displayName, 1, DISPLAY_NAME_MAX_LENGTH)],
    ['phone', phone === null ? null : checkPhone(phone)],
  ]);
  return issues.length > 0 ? { ok: false, issues } : { ok: true, value: { displayName, phone } };
}

export interface AddressInput {
  label: string;
  addressLine: string;
  reference?: string;
  location: GeoPoint;
}

export type PreparedAddress = Required<AddressInput>;

export function prepareAddress(input: AddressInput): Validated<PreparedAddress> {
  const value: PreparedAddress = {
    label: input.label.trim(),
    addressLine: input.addressLine.trim(),
    reference: (input.reference ?? '').trim(),
    location: input.location,
  };
  const issues = collectIssues([
    ['label', checkText(value.label, 1, ADDRESS_LABEL_MAX_LENGTH)],
    ['addressLine', checkText(value.addressLine, 1, ADDRESS_LINE_MAX_LENGTH)],
    ['reference', checkText(value.reference, 0, ADDRESS_REFERENCE_MAX_LENGTH)],
    ['location', isValidGeoPoint(value.location) ? null : 'invalid'],
  ]);
  return issues.length > 0 ? { ok: false, issues } : { ok: true, value };
}

/**
 * Addresses live in fixed slots (`a0` … `a9`) instead of automatic ids: it is the only way the
 * security rules can cap how many an account keeps without a server.
 */
export const ADDRESS_SLOT_IDS: readonly string[] = Array.from(
  { length: MAX_ADDRESSES_PER_USER },
  (_, index) => `a${index}`,
);

/** First slot not in `usedIds`, or null when the account is at the limit. */
export function firstFreeAddressSlot(usedIds: readonly string[]): string | null {
  return ADDRESS_SLOT_IDS.find((slot) => !usedIds.includes(slot)) ?? null;
}
