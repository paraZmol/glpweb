import { InvalidInputError, NothingChangedError } from '../../domain/tenancy/errors';
import type { DistributorPrivateSettings } from '../../domain/tenancy/types';
import {
  type BusinessVerificationInput,
  prepareBusinessVerification,
} from '../../domain/tenancy/verification-input';
import { type ReloadableResource, useAsyncResource } from '../../lib/use-async-resource';
import { getPrivateSettings } from './tenancy-actions';
import { describeTenancyError, fieldMessagesOf } from './tenancy-messages';

export type VerificationErrors = Partial<Record<keyof BusinessVerificationInput | 'form', string>>;

/** The three fields as the founder declared them, to correct them in place. */
export function verificationFormOf(
  settings: DistributorPrivateSettings,
): BusinessVerificationInput {
  const { taxId, legalName, hydrocarbonsRegistry } = settings;
  return { taxId, legalName, hydrocarbonsRegistry };
}

/** Problems of the three verification fields, with the rules `correctVerificationData` applies. */
export function validateVerification(input: BusinessVerificationInput): VerificationErrors {
  const prepared = prepareBusinessVerification(input);
  return prepared.ok ? {} : fieldMessagesOf(new InvalidInputError(prepared.issues));
}

const NOTHING_CHANGED = 'No cambiaste nada todavía: corrige el dato que te pidieron y guarda.';

export function verificationErrorsOf(error: unknown): VerificationErrors {
  if (error instanceof InvalidInputError) return fieldMessagesOf(error);
  if (error instanceof NothingChangedError) return { form: NOTHING_CHANGED };
  return { form: describeTenancyError(error) };
}

/**
 * What the founder declared about the business (PLAN 2.11), to correct it when the platform
 * asks. Only the founder can read it: for anybody else the resource is an error
 * (`PermissionDeniedError`). Pass null to load nothing. One read per load, no listener.
 */
export function useVerificationData(
  distributorId: string | null,
): ReloadableResource<DistributorPrivateSettings | null> {
  return useAsyncResource(distributorId, () =>
    distributorId === null ? Promise.resolve(null) : getPrivateSettings(distributorId),
  );
}
