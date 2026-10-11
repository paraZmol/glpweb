import { HORNILLA_BRAND_COLOR } from '../../domain/brand/derive-brand';
import type { GeoPoint } from '../../domain/geo/distance';
import { DEFAULT_COVERAGE_RADIUS_KM } from '../../domain/tenancy/constants';
import {
  type NewDistributorInput,
  prepareNewDistributor,
} from '../../domain/tenancy/distributor-input';
import { InvalidInputError, SlugTakenError } from '../../domain/tenancy/errors';
import { checkConsent, collectIssues, type FieldIssue } from '../../domain/tenancy/field-checks';
import { describeTenancyError, fieldMessagesOf } from './tenancy-messages';

/** One subject per step (PLAN 2.2). */
export const FOUNDING_STEPS = ['business', 'location', 'brand', 'review'] as const;
export type FoundingStep = (typeof FOUNDING_STEPS)[number];

/** What the wizard holds while the person fills it in: text as typed, boxes unticked. */
export interface FoundingForm {
  name: string;
  slug: string;
  contactPhone: string;
  /** Empty means "the same as the phone". */
  whatsapp: string;
  ownerName: string;
  ownerPhone: string;
  /** Business verification data (PLAN 2.11): required, private, reviewed by the platform. */
  taxId: string;
  legalName: string;
  hydrocarbonsRegistry: string;
  addressLine: string;
  latitude: string;
  longitude: string;
  coverageRadiusKm: number;
  brandColor: string;
  acceptTerms: boolean;
  declaresAuthority: boolean;
}

/** `plant` stands for latitude and longitude together: they are valid or not as a pair. */
export type FoundingField = Exclude<keyof FoundingForm, 'latitude' | 'longitude'> | 'plant';
export type FoundingErrors = Partial<Record<FoundingField | 'form', string>>;

const STEP_FIELDS: Record<FoundingStep, readonly FoundingField[]> = {
  business: [
    'name',
    'slug',
    'contactPhone',
    'whatsapp',
    'ownerPhone',
    'taxId',
    'legalName',
    'hydrocarbonsRegistry',
  ],
  location: ['plant', 'addressLine', 'coverageRadiusKm'],
  brand: ['brandColor'],
  review: ['acceptTerms', 'declaresAuthority'],
};

// The shared messages talk about a map that does not exist yet (phase 6).
const WIZARD_MESSAGES: Partial<Record<FoundingField, string>> = {
  plant:
    'Indica dónde está la planta: usa tu ubicación o escribe la latitud y la longitud con sus decimales.',
  name: 'Escribe el nombre de tu distribuidora.',
};
const NAME_TOO_SHORT = 'El nombre necesita al menos 2 letras.';

export function emptyFoundingForm(owner: {
  displayName: string;
  phone: string | null;
}): FoundingForm {
  return {
    name: '',
    slug: '',
    contactPhone: '',
    whatsapp: '',
    ownerName: owner.displayName,
    ownerPhone: owner.phone ?? '',
    taxId: '',
    legalName: '',
    hydrocarbonsRegistry: '',
    addressLine: '',
    latitude: '',
    longitude: '',
    coverageRadiusKm: DEFAULT_COVERAGE_RADIUS_KM,
    brandColor: HORNILLA_BRAND_COLOR,
    acceptTerms: false,
    declaresAuthority: false,
  };
}

/** A coordinate as typed: a decimal comma is accepted, an empty field is not a zero. */
function coordinateOf(text: string): number {
  const trimmed = text.trim().replace(',', '.');
  return trimmed === '' ? Number.NaN : Number(trimmed);
}

/** The plant as typed. Not validated here: `prepareNewDistributor` refuses a bad point. */
export function plantOf(form: Pick<FoundingForm, 'latitude' | 'longitude'>): GeoPoint {
  return { lat: coordinateOf(form.latitude), lng: coordinateOf(form.longitude) };
}

export function toFoundingInput(form: FoundingForm): NewDistributorInput {
  return {
    name: form.name,
    slug: form.slug,
    contactPhone: form.contactPhone,
    whatsapp: form.whatsapp.trim() === '' ? undefined : form.whatsapp,
    addressLine: form.addressLine,
    plant: plantOf(form),
    coverageRadiusKm: form.coverageRadiusKm,
    brandColor: form.brandColor,
    ownerName: form.ownerName,
    ownerPhone: form.ownerPhone,
    taxId: form.taxId,
    legalName: form.legalName,
    hydrocarbonsRegistry: form.hydrocarbonsRegistry,
  };
}

function issuesOf(form: FoundingForm): FieldIssue[] {
  const prepared = prepareNewDistributor(toFoundingInput(form));
  return [
    ...(prepared.ok ? [] : prepared.issues),
    ...collectIssues([
      ['acceptTerms', checkConsent(form.acceptTerms)],
      ['declaresAuthority', checkConsent(form.declaresAuthority)],
    ]),
  ];
}

function messageOf(field: FoundingField, issues: FieldIssue[]): string | undefined {
  const issue = issues.find((candidate) => candidate.field === field);
  if (!issue) return undefined;
  if (field === 'name' && issue.code === 'tooShort') return NAME_TOO_SHORT;
  const isRequired = issue.code === 'required' || field === 'plant';
  const own = isRequired ? WIZARD_MESSAGES[field] : undefined;
  return own ?? fieldMessagesOf(new InvalidInputError([issue]))[field];
}

function errorsFor(fields: readonly FoundingField[], issues: FieldIssue[]): FoundingErrors {
  const entries = fields.map((field) => [field, messageOf(field, issues)] as const);
  return Object.fromEntries(entries.filter(([, message]) => message)) as FoundingErrors;
}

/** Problems of the fields of one step, with the same rules the founding applies. */
export function validateFoundingStep(step: FoundingStep, form: FoundingForm): FoundingErrors {
  return errorsFor(STEP_FIELDS[step], issuesOf(form));
}

/** The first step that still has a problem, or null when the whole form can be sent. */
export function firstStepWithProblems(form: FoundingForm): FoundingStep | null {
  const issues = issuesOf(form);
  const hasProblem = (step: FoundingStep) =>
    Object.keys(errorsFor(STEP_FIELDS[step], issues)).length > 0;
  return FOUNDING_STEPS.find(hasProblem) ?? null;
}

export function stepOfField(field: string): FoundingStep | null {
  return (
    FOUNDING_STEPS.find((step) => (STEP_FIELDS[step] as readonly string[]).includes(field)) ?? null
  );
}

/** Where a failed founding belongs: next to its field when it is about one, else on the form. */
export function foundingErrorsOf(error: unknown): FoundingErrors {
  if (error instanceof SlugTakenError) return { slug: describeTenancyError(error) };
  if (!(error instanceof InvalidInputError)) return { form: describeTenancyError(error) };
  const known = error.issues.filter((issue) => stepOfField(issue.field) !== null);
  const fields = known.map((issue) => issue.field as FoundingField);
  const errors = errorsFor(fields, known);
  return known.length === error.issues.length
    ? errors
    : { ...errors, form: describeTenancyError(error) };
}

/** The step to show after a failed founding: the one of its first field, if it has one. */
export function stepOfErrors(errors: FoundingErrors): FoundingStep | null {
  return FOUNDING_STEPS.find((step) => STEP_FIELDS[step].some((field) => errors[field])) ?? null;
}
