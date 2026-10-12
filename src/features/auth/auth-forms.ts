import { isAuthError } from '../../domain/auth/errors';
import { prepareUserProfile } from '../../domain/tenancy/account-input';
import { InvalidInputError } from '../../domain/tenancy/errors';
import { describeTenancyError, fieldMessagesOf } from '../tenancy/tenancy-messages';
import { describeAuthError } from './auth-messages';

/** Messages to paint a form: one per field, plus one for the whole form. */
export type FormErrors<Field extends string> = Partial<Record<Field | 'form', string>>;

export type ProfileErrors = FormErrors<'displayName' | 'phone'>;

const MISSING_NAME = 'Escribe tu nombre.';
const MISSING_CONSENT = 'Marca esta casilla para aceptar los términos y continuar.';
const MISSING_PRIVACY_CONSENT =
  'Marca esta casilla para autorizar el uso de tus datos y continuar.';

export type ConsentErrors = FormErrors<'acceptTerms' | 'acceptPrivacy'>;

function withoutEmpty<T extends Record<string, string | undefined>>(errors: T): T {
  return Object.fromEntries(Object.entries(errors).filter(([, message]) => message)) as T;
}

/** Name and phone, with the same rules the repository applies (`prepareUserProfile`). */
export function validateProfile(form: { displayName: string; phone: string }): ProfileErrors {
  const prepared = prepareUserProfile(form);
  if (prepared.ok) return {};
  const messages = fieldMessagesOf(new InvalidInputError(prepared.issues));
  const isNameMissing = form.displayName.trim() === '';
  return withoutEmpty({
    displayName: isNameMissing ? MISSING_NAME : messages.displayName,
    phone: messages.phone,
  });
}

/**
 * The two boxes every account ticks on the terms step (PLAN 2.9, 2.11): terms and age; privacy
 * policy and use of data.
 * Anything but `true` is a missing consent.
 */
export function validateConsents(boxes: {
  acceptTerms: boolean;
  acceptPrivacy?: boolean;
}): ConsentErrors {
  return withoutEmpty({
    acceptTerms: boxes.acceptTerms ? undefined : MISSING_CONSENT,
    acceptPrivacy: boxes.acceptPrivacy === true ? undefined : MISSING_PRIVACY_CONSENT,
  });
}

export function hasErrors(errors: Record<string, string | undefined>): boolean {
  return Object.values(errors).some(Boolean);
}

/** Failure of an action on an existing account (saving the profile, accepting the terms). */
export function profileErrorsOf(error: unknown): ProfileErrors {
  if (error instanceof InvalidInputError) return fieldMessagesOf(error);
  return { form: isAuthError(error) ? describeAuthError(error) : describeTenancyError(error) };
}
