import {
  HYDROCARBONS_REGISTRY_MAX_LENGTH,
  HYDROCARBONS_REGISTRY_MIN_LENGTH,
  LEGAL_NAME_MAX_LENGTH,
  LEGAL_NAME_MIN_LENGTH,
} from './constants';
import { type Check, checkText, collectIssues, type Validated } from './field-checks';
import { isValidRuc, normalizeRuc } from './tax-id';

/**
 * What the platform asks a business for before listing it (PLAN 2.11): who it is for the tax
 * office and under which record it may sell GLP. Declared by the founder, looked at by a
 * platform admin, never public: stored in `private/settings`.
 */
export interface BusinessVerificationInput {
  /** RUC, as typed (spaces and hyphens are dropped). */
  taxId: string;
  /** Registered business name, or the full name of the holder when it is a natural person. */
  legalName: string;
  /** Record number in Osinergmin's Registro de Hidrocarburos, as printed on the record. */
  hydrocarbonsRegistry: string;
}

export type BusinessVerification = BusinessVerificationInput;

export const VERIFICATION_FIELDS = [
  'taxId',
  'legalName',
  'hydrocarbonsRegistry',
] as const satisfies readonly (keyof BusinessVerification)[];

/**
 * Letters, digits and the separators such records are printed with, starting and ending in a
 * letter or digit. The exact format of the record is not assumed: a platform admin reads it.
 * firebase/firestore.rules repeats the pattern (isRegistryNumber).
 */
const REGISTRY_PATTERN = /^[A-Z0-9](?:[A-Z0-9 ./-]*[A-Z0-9])?$/;
const SPACES = /\s+/g;

function checkTaxId(taxId: string): Check {
  if (taxId === '') return 'required';
  return isValidRuc(taxId) ? null : 'invalid';
}

function checkRegistry(registry: string): Check {
  const length = checkText(
    registry,
    HYDROCARBONS_REGISTRY_MIN_LENGTH,
    HYDROCARBONS_REGISTRY_MAX_LENGTH,
  );
  if (length) return length;
  return REGISTRY_PATTERN.test(registry) ? null : 'invalid';
}

/** Normalises and validates the three verification fields. */
export function prepareBusinessVerification(
  input: BusinessVerificationInput,
): Validated<BusinessVerification> {
  const value: BusinessVerification = {
    taxId: normalizeRuc(input.taxId),
    legalName: input.legalName.trim().replace(SPACES, ' '),
    hydrocarbonsRegistry: input.hydrocarbonsRegistry.trim().replace(SPACES, ' ').toUpperCase(),
  };
  const issues = collectIssues([
    ['taxId', checkTaxId(value.taxId)],
    ['legalName', checkText(value.legalName, LEGAL_NAME_MIN_LENGTH, LEGAL_NAME_MAX_LENGTH)],
    ['hydrocarbonsRegistry', checkRegistry(value.hydrocarbonsRegistry)],
  ]);
  return issues.length > 0 ? { ok: false, issues } : { ok: true, value };
}
