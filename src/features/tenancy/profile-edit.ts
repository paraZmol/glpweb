import { normalizeBrandColor, normalizePeruvianMobile } from '../../domain/tenancy/contact';
import {
  type DistributorProfilePatch,
  prepareProfilePatch,
} from '../../domain/tenancy/distributor-input';
import { InvalidInputError } from '../../domain/tenancy/errors';
import type { PublicDistributor } from '../../domain/tenancy/types';
import { describeTenancyError, fieldMessagesOf } from './tenancy-messages';

/** What the owner edits of the public profile (PLAN 2.11), as typed. */
export interface ProfileEditForm {
  name: string;
  contactPhone: string;
  whatsapp: string;
  addressLine: string;
  coverageRadiusKm: number;
  brandColor: string;
  days: number[];
  opensAt: string;
  closesAt: string;
}

export type ProfileEditField =
  | 'name'
  | 'contactPhone'
  | 'whatsapp'
  | 'addressLine'
  | 'coverageRadiusKm'
  | 'brandColor'
  | 'schedule';
export type ProfileEditErrors = Partial<Record<ProfileEditField | 'form', string>>;

const OWN_MESSAGES: Partial<Record<ProfileEditField, string>> = {
  name: 'Escribe el nombre de tu distribuidora, con al menos 2 letras.',
  schedule: 'Elige al menos un día y escribe la hora de apertura y la de cierre.',
};

export function profileEditFormOf(distributor: PublicDistributor): ProfileEditForm {
  return {
    name: distributor.name,
    contactPhone: distributor.contactPhone,
    whatsapp: distributor.whatsapp,
    addressLine: distributor.addressLine,
    coverageRadiusKm: distributor.coverageRadiusKm,
    brandColor: distributor.brandColor,
    days: [...distributor.schedule.days],
    opensAt: distributor.schedule.opensAt,
    closesAt: distributor.schedule.closesAt,
  };
}

/** Adds or removes a day, keeping the list in the order of the week. */
export function toggleDay(days: readonly number[], day: number): number[] {
  const next = days.includes(day) ? days.filter((kept) => kept !== day) : [...days, day];
  return next.sort((left, right) => left - right);
}

function sameDays(left: readonly number[], right: readonly number[]): boolean {
  const sorted = (days: readonly number[]) => [...days].sort((a, b) => a - b).join(',');
  return sorted(left) === sorted(right);
}

function isSameColor(typed: string, stored: string): boolean {
  return normalizeBrandColor(typed) === normalizeBrandColor(stored);
}

/**
 * ONLY what changed, compared as it would be stored (a phone typed with spaces is the same
 * phone). The repository sends the listing back to review when the patch carries the name or a
 * phone, the address or the plant, so a field that did not change must never travel
 * (`touchesIdentity`).
 */
export function profilePatchOf(
  form: ProfileEditForm,
  stored: PublicDistributor,
): DistributorProfilePatch {
  const patch: DistributorProfilePatch = {};
  if (form.name.trim() !== stored.name) patch.name = form.name;
  if (normalizePeruvianMobile(form.contactPhone) !== stored.contactPhone) {
    patch.contactPhone = form.contactPhone;
  }
  if (normalizePeruvianMobile(form.whatsapp) !== stored.whatsapp) patch.whatsapp = form.whatsapp;
  if (form.addressLine.trim() !== stored.addressLine) patch.addressLine = form.addressLine;
  if (form.coverageRadiusKm !== stored.coverageRadiusKm) {
    patch.coverageRadiusKm = form.coverageRadiusKm;
  }
  if (!isSameColor(form.brandColor, stored.brandColor)) patch.brandColor = form.brandColor;
  const { schedule } = stored;
  const isSameSchedule =
    sameDays(form.days, schedule.days) &&
    form.opensAt === schedule.opensAt &&
    form.closesAt === schedule.closesAt;
  if (!isSameSchedule) {
    patch.schedule = { days: [...form.days], opensAt: form.opensAt, closesAt: form.closesAt };
  }
  return patch;
}

export function hasChanges(patch: DistributorProfilePatch): boolean {
  return Object.keys(patch).length > 0;
}

function messagesOf(error: InvalidInputError): ProfileEditErrors {
  const shared = fieldMessagesOf(error);
  const entries = error.issues.map(({ field }) => {
    const own = OWN_MESSAGES[field as ProfileEditField];
    return [field, own ?? shared[field]] as const;
  });
  return Object.fromEntries(entries) as ProfileEditErrors;
}

/** Problems of an edit, with the same rules `editDistributorProfile` applies. */
export function validateProfileEdit(patch: DistributorProfilePatch): ProfileEditErrors {
  const prepared = prepareProfilePatch(patch);
  return prepared.ok ? {} : messagesOf(new InvalidInputError(prepared.issues));
}

/** Where a failed save belongs: next to its field when it is about one, else on the form. */
export function profileEditErrorsOf(error: unknown): ProfileEditErrors {
  if (error instanceof InvalidInputError) return messagesOf(error);
  return { form: describeTenancyError(error) };
}
