import { authErrorFor, isAuthError } from '../../domain/auth/errors';
import { isAcceptablePassword, isValidEmail, normalizeEmail } from '../../domain/auth/session';
import { prepareUserProfile } from '../../domain/tenancy/account-input';
import { InvalidInputError } from '../../domain/tenancy/errors';
import { describeTenancyError, fieldMessagesOf } from '../tenancy/tenancy-messages';
import { describeAuthError } from './auth-messages';

/** Messages to paint a sign-in or registration form: one per field, plus one for the whole form. */
export type FormErrors<Field extends string> = Partial<Record<Field | 'form', string>>;

export type SignInErrors = FormErrors<'email' | 'password'>;
export type RegistrationErrors = FormErrors<'displayName' | 'email' | 'password' | 'phone'>;
export type ProfileErrors = FormErrors<'displayName' | 'phone'>;

export interface RegistrationForm {
  displayName: string;
  email: string;
  password: string;
  phone: string;
}

const MISSING_NAME = 'Escribe tu nombre.';
const MISSING_PASSWORD = 'Escribe tu contraseña.';
const MISSING_CONSENT = 'Marca esta casilla para aceptar los términos y continuar.';
const MISSING_PRIVACY_CONSENT =
  'Marca esta casilla para autorizar el uso de tus datos y continuar.';

export type ConsentErrors = FormErrors<'acceptTerms' | 'acceptPrivacy'>;

/** Message for an address that is not an e-mail; undefined when its shape is fine. */
export function emailProblemOf(email: string): string | undefined {
  if (isValidEmail(normalizeEmail(email))) return undefined;
  return describeAuthError(authErrorFor('invalidEmail'));
}

function withoutEmpty<T extends Record<string, string | undefined>>(errors: T): T {
  return Object.fromEntries(Object.entries(errors).filter(([, message]) => message)) as T;
}

/** Checks a sign-in form before sending it. Says nothing about whether the account exists. */
export function validateSignIn(form: { email: string; password: string }): SignInErrors {
  return withoutEmpty({
    email: emailProblemOf(form.email),
    password: form.password === '' ? MISSING_PASSWORD : undefined,
  });
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

/**
 * Every problem of the registration form at once, so the person fixes them in one go. The form
 * carries no consent (PLAN 2.11): the terms and the privacy policy are accepted on the terms
 * step, once the e-mail is verified (`validateConsents`).
 */
export function validateRegistration(form: RegistrationForm): RegistrationErrors {
  return withoutEmpty({
    ...validateProfile(form),
    email: emailProblemOf(form.email),
    password: isAcceptablePassword(form.password)
      ? undefined
      : describeAuthError(authErrorFor('weakPassword')),
  });
}

export function hasErrors(errors: Record<string, string | undefined>): boolean {
  return Object.values(errors).some(Boolean);
}

/** Where the message of a failed sign-in belongs: next to its field when it is about one. */
export function signInErrorsOf(error: unknown): SignInErrors {
  const message = describeAuthError(error);
  if (isAuthError(error, 'invalidEmail')) return { email: message };
  return { form: message };
}

/** The same for a failed registration, which can also be refused field by field. */
export function registrationErrorsOf(error: unknown): RegistrationErrors {
  if (error instanceof InvalidInputError) {
    return { ...fieldMessagesOf(error), form: describeTenancyError(error) };
  }
  if (!isAuthError(error)) return { form: describeTenancyError(error) };
  const message = describeAuthError(error);
  if (isAuthError(error, 'invalidEmail') || isAuthError(error, 'emailAlreadyInUse')) {
    return { email: message };
  }
  return isAuthError(error, 'weakPassword') ? { password: message } : { form: message };
}

/** Failure of an action on an existing account (saving the profile, accepting the terms). */
export function profileErrorsOf(error: unknown): ProfileErrors {
  if (error instanceof InvalidInputError) return fieldMessagesOf(error);
  return { form: isAuthError(error) ? describeAuthError(error) : describeTenancyError(error) };
}
