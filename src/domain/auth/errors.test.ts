import { describe, expect, it } from 'vitest';
import {
  AUTH_ERROR_CODES,
  AuthError,
  authErrorFor,
  EmailAlreadyInUseError,
  InvalidCredentialsError,
  isAuthError,
  SignInCancelledError,
  TooManyAttemptsError,
  WeakPasswordError,
} from './errors';

describe('authErrorFor', () => {
  it.each([
    ['emailAlreadyInUse', EmailAlreadyInUseError],
    ['invalidCredentials', InvalidCredentialsError],
    ['weakPassword', WeakPasswordError],
    ['tooManyAttempts', TooManyAttemptsError],
    ['cancelled', SignInCancelledError],
  ] as const)('builds the named class for %s', (code, expectedClass) => {
    const error = authErrorFor(code);
    expect(error).toBeInstanceOf(expectedClass);
    expect(error.code).toBe(code);
  });

  it('keeps the code and the cause for every code', () => {
    const cause = new Error('original');
    const mismatched = AUTH_ERROR_CODES.filter((code) => {
      const error = authErrorFor(code, cause);
      return error.code !== code || error.cause !== cause || !(error instanceof AuthError);
    });
    expect(mismatched).toEqual([]);
  });
});

describe('isAuthError', () => {
  it('narrows by class and optionally by code', () => {
    const error = authErrorFor('network');
    expect(isAuthError(error)).toBe(true);
    expect(isAuthError(error, 'network')).toBe(true);
    expect(isAuthError(error, 'cancelled')).toBe(false);
    expect(isAuthError(new Error('other'))).toBe(false);
    expect(isAuthError(null)).toBe(false);
  });
});
