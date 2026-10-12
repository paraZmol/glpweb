import { describe, expect, it } from 'vitest';
import { authErrorFor } from '../../domain/auth/errors';
import { InvalidInputError, OfflineError } from '../../domain/tenancy/errors';
import { hasErrors, profileErrorsOf, validateConsents, validateProfile } from './auth-forms';

describe('validateConsents', () => {
  // PLAN 2.9, 2.11: the two boxes of the terms step.
  it('checks the two boxes on their own', () => {
    expect(validateConsents({ acceptTerms: true, acceptPrivacy: true })).toEqual({});
    expect(validateConsents({ acceptTerms: false, acceptPrivacy: false })).toEqual({
      acceptTerms: 'Marca esta casilla para aceptar los términos y continuar.',
      acceptPrivacy: 'Marca esta casilla para autorizar el uso de tus datos y continuar.',
    });
  });

  it.each([
    ['unticked', { acceptPrivacy: false }],
    ['missing', { acceptPrivacy: undefined }],
  ])('refuses the privacy box %s even with the terms ticked', (_case, patch) => {
    expect(Object.keys(validateConsents({ acceptTerms: true, ...patch }))).toEqual([
      'acceptPrivacy',
    ]);
  });

  it('counts as errors only the fields that carry a message', () => {
    expect(hasErrors({})).toBe(false);
    expect(hasErrors({ acceptTerms: undefined })).toBe(false);
    expect(hasErrors(validateConsents({ acceptTerms: false }))).toBe(true);
  });
});

describe('validateProfile', () => {
  it.each([
    [{ displayName: 'Persona Demo', phone: '' }, []],
    [{ displayName: 'Persona Demo', phone: '+51 900 000 012' }, []],
    [{ displayName: '', phone: '' }, ['displayName']],
    [{ displayName: 'Persona Demo', phone: '90000001' }, ['phone']],
    [{ displayName: ' ', phone: 'abc' }, ['displayName', 'phone']],
    [{ displayName: 'x'.repeat(81), phone: '' }, ['displayName']],
    [{ displayName: 'Ñusta Peña 🔥', phone: '900 000 012' }, []],
    [{ displayName: 'Persona Demo', phone: '800000012' }, ['phone']],
  ])('%j → %j', (form, fields) => {
    expect(Object.keys(validateProfile(form)).sort()).toEqual(fields);
  });

  it('asks for the name in plain words when it is missing', () => {
    expect(validateProfile({ displayName: '', phone: '' }).displayName).toBe('Escribe tu nombre.');
  });
});

describe('where a failure is shown', () => {
  it('paints the fields the repository rejected', () => {
    const error = new InvalidInputError([
      { field: 'phone', code: 'invalid' },
      { field: 'acceptTerms', code: 'required' },
    ]);

    expect(Object.keys(profileErrorsOf(error)).sort()).toEqual(['acceptTerms', 'phone']);
  });

  it('explains a lost connection and anything unexpected for the whole form', () => {
    expect(profileErrorsOf(new OfflineError()).form).toMatch(/conexión/);
    expect(profileErrorsOf(authErrorFor('notSignedIn')).form).toMatch(/sesión/);
    expect(profileErrorsOf(new Error('boom')).form).toBe(
      'No pudimos completar la acción. Vuelve a intentar.',
    );
  });
});
