import { DomainError } from '../tenancy/errors';

/**
 * Sign-in problems the screens know how to explain. `code` is stable (class names are mangled
 * by the production build), so it is safe to switch on or to log.
 */
export const AUTH_ERROR_CODES = [
  'tooManyAttempts',
  'network',
  'cancelled',
  'accountDisabled',
  'providerMismatch',
  'recentLoginRequired',
  'notSignedIn',
  'unknown',
] as const;
export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[number];

export class AuthError extends DomainError {
  constructor(
    readonly code: AuthErrorCode,
    options?: ErrorOptions,
  ) {
    super(`Authentication failed: ${code}`, options);
  }
}

export function isAuthError(error: unknown, code?: AuthErrorCode): error is AuthError {
  return error instanceof AuthError && (code === undefined || error.code === code);
}

export class TooManyAttemptsError extends AuthError {
  constructor(options?: ErrorOptions) {
    super('tooManyAttempts', options);
  }
}

export class SignInCancelledError extends AuthError {
  constructor(options?: ErrorOptions) {
    super('cancelled', options);
  }
}

const NAMED_ERRORS: Partial<Record<AuthErrorCode, new (options?: ErrorOptions) => AuthError>> = {
  tooManyAttempts: TooManyAttemptsError,
  cancelled: SignInCancelledError,
};

/** Builds the most specific error class for a code. */
export function authErrorFor(code: AuthErrorCode, cause?: unknown): AuthError {
  const Named = NAMED_ERRORS[code];
  return Named ? new Named({ cause }) : new AuthError(code, { cause });
}
