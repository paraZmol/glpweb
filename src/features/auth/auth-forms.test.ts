import { describe, expect, it } from 'vitest';
import { authErrorFor } from '../../domain/auth/errors';
import { MIN_PASSWORD_LENGTH } from '../../domain/auth/session';
import { InvalidInputError, OfflineError } from '../../domain/tenancy/errors';
import {
  hasErrors,
  profileErrorsOf,
  type RegistrationForm,
  registrationErrorsOf,
  signInErrorsOf,
  validateConsents,
  validateProfile,
  validateRegistration,
  validateSignIn,
} from './auth-forms';

const VALID: RegistrationForm = {
  displayName: 'Persona Demo',
  email: 'persona@example.com',
  password: 'x'.repeat(MIN_PASSWORD_LENGTH),
  phone: '',
  acceptTerms: true,
  acceptPrivacy: true,
};

// PLAN 2.1 and 2.7: the registration form.
describe('validateRegistration', () => {
  it('accepts a complete form, with or without a phone', () => {
    expect(validateRegistration(VALID)).toEqual({});
    expect(validateRegistration({ ...VALID, phone: '900 000 012' })).toEqual({});
    expect(validateRegistration({ ...VALID, email: '  Persona@Example.com ' })).toEqual({});
  });

  it('refuses to go on without the terms box, even when everything else is right', () => {
    const errors = validateRegistration({ ...VALID, acceptTerms: false });

    expect(errors).toEqual({
      acceptTerms: 'Marca esta casilla para aceptar los términos y continuar.',
    });
    expect(hasErrors(errors)).toBe(true);
  });

  // PLAN 2.9: the privacy policy has its own box.
  it.each([
    ['unticked', { acceptPrivacy: false }],
    ['missing from the form', { acceptPrivacy: undefined }],
  ])('refuses to go on with the privacy box %s', (_case, patch) => {
    const errors = validateRegistration({ ...VALID, ...patch });

    expect(Object.keys(errors)).toEqual(['acceptPrivacy']);
    expect(errors.acceptPrivacy).toBe(
      'Marca esta casilla para autorizar el uso de tus datos y continuar.',
    );
  });

  // PLAN 2.9: the same two boxes on the pending step of an existing account.
  it('checks the two boxes on their own', () => {
    expect(validateConsents({ acceptTerms: true, acceptPrivacy: true })).toEqual({});
    expect(Object.keys(validateConsents({ acceptTerms: false, acceptPrivacy: false }))).toEqual([
      'acceptTerms',
      'acceptPrivacy',
    ]);
  });

  it.each([
    ['displayName', { displayName: '   ' }],
    ['displayName', { displayName: 'x'.repeat(81) }],
    ['email', { email: 'persona@' }],
    ['email', { email: '' }],
    ['password', { password: 'x'.repeat(MIN_PASSWORD_LENGTH - 1) }],
    ['password', { password: '' }],
    ['phone', { phone: '12345' }],
    ['phone', { phone: '800000012' }],
  ] as const)('marks %s for %j', (field, patch) => {
    expect(Object.keys(validateRegistration({ ...VALID, ...patch }))).toEqual([field]);
  });

  it('accepts a password of exactly the minimum length and names with tildes or emoji', () => {
    expect(validateRegistration({ ...VALID, displayName: 'Ñusta Peña 🔥' })).toEqual({});
    expect(validateRegistration({ ...VALID, password: 'ñ'.repeat(MIN_PASSWORD_LENGTH) })).toEqual(
      {},
    );
  });

  it('reports every problem of an empty form at once', () => {
    const errors = validateRegistration({
      displayName: '',
      email: '',
      password: '',
      phone: '',
      acceptTerms: false,
      acceptPrivacy: false,
    });

    expect(Object.keys(errors).sort()).toEqual([
      'acceptPrivacy',
      'acceptTerms',
      'displayName',
      'email',
      'password',
    ]);
    expect(errors.displayName).toBe('Escribe tu nombre.');
  });
});

describe('validateSignIn', () => {
  it('accepts an e-mail and any password (the server judges it)', () => {
    expect(validateSignIn({ email: 'persona@example.com', password: 'x' })).toEqual({});
  });

  it('asks for both fields', () => {
    expect(Object.keys(validateSignIn({ email: 'nadie', password: '' })).sort()).toEqual([
      'email',
      'password',
    ]);
  });
});

describe('validateProfile', () => {
  it.each([
    [{ displayName: 'Persona Demo', phone: '' }, []],
    [{ displayName: 'Persona Demo', phone: '+51 900 000 012' }, []],
    [{ displayName: '', phone: '' }, ['displayName']],
    [{ displayName: 'Persona Demo', phone: '90000001' }, ['phone']],
    [{ displayName: ' ', phone: 'abc' }, ['displayName', 'phone']],
  ])('%j → %j', (form, fields) => {
    expect(Object.keys(validateProfile(form)).sort()).toEqual(fields);
  });
});

describe('where a failure is shown', () => {
  it('puts a rejected e-mail next to its field when signing in', () => {
    expect(Object.keys(signInErrorsOf(authErrorFor('invalidEmail')))).toEqual(['email']);
  });

  it.each([
    'invalidCredentials',
    'tooManyAttempts',
    'network',
    'accountDisabled',
    'unknown',
  ] as const)('shows %s for the whole sign-in form, never pointing at one field', (code) => {
    expect(Object.keys(signInErrorsOf(authErrorFor(code)))).toEqual(['form']);
  });

  it('uses the same words for a wrong password and for an unknown account', () => {
    const wrongPassword = signInErrorsOf(authErrorFor('invalidCredentials'));

    expect(wrongPassword.form).toBe('El correo o la contraseña no coinciden.');
  });

  it.each([
    ['emailAlreadyInUse', 'email'],
    ['invalidEmail', 'email'],
    ['weakPassword', 'password'],
    ['network', 'form'],
    ['tooManyAttempts', 'form'],
  ] as const)('shows %s of a registration in %s', (code, field) => {
    expect(Object.keys(registrationErrorsOf(authErrorFor(code)))).toEqual([field]);
  });

  it('paints the fields the repository rejected, and says so for the whole form', () => {
    const error = new InvalidInputError([
      { field: 'phone', code: 'invalid' },
      { field: 'acceptTerms', code: 'required' },
    ]);

    expect(Object.keys(registrationErrorsOf(error)).sort()).toEqual([
      'acceptTerms',
      'form',
      'phone',
    ]);
    expect(Object.keys(profileErrorsOf(error)).sort()).toEqual(['acceptTerms', 'phone']);
  });

  it('explains a lost connection and anything unexpected for the whole form', () => {
    expect(registrationErrorsOf(new OfflineError()).form).toMatch(/conexión/);
    expect(profileErrorsOf(new OfflineError()).form).toMatch(/conexión/);
    expect(profileErrorsOf(authErrorFor('notSignedIn')).form).toMatch(/sesión/);
    expect(profileErrorsOf(new Error('boom')).form).toBe(
      'No pudimos completar la acción. Vuelve a intentar.',
    );
  });
});
