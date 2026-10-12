import { describe, expect, it } from 'vitest';
import {
  AuthError,
  EmailAlreadyInUseError,
  InvalidCredentialsError,
  TooManyAttemptsError,
} from '../domain/auth/errors';
import { OfflineError, PermissionDeniedError, SlugTakenError } from '../domain/tenancy/errors';
import {
  authErrorCodeFor,
  firebaseCodeOf,
  guarded,
  isPopupUnavailable,
  toAuthError,
  toDataError,
  withDeadline,
} from './errors';

const firebaseError = (code: string) => Object.assign(new Error(code), { code });

describe('firebaseCodeOf', () => {
  it.each([
    [firebaseError('permission-denied'), 'permission-denied'],
    [new Error('plain'), null],
    [{ code: 42 }, null],
    ['text', null],
    [null, null],
  ])('%o → %s', (error, expected) => {
    expect(firebaseCodeOf(error)).toBe(expected);
  });
});

describe('authErrorCodeFor', () => {
  it.each([
    ['auth/email-already-in-use', 'emailAlreadyInUse'],
    ['auth/invalid-credential', 'invalidCredentials'],
    ['auth/wrong-password', 'invalidCredentials'],
    ['auth/user-not-found', 'invalidCredentials'],
    ['auth/invalid-email', 'invalidEmail'],
    ['auth/weak-password', 'weakPassword'],
    ['auth/too-many-requests', 'tooManyAttempts'],
    ['auth/network-request-failed', 'network'],
    ['auth/popup-closed-by-user', 'cancelled'],
    ['auth/user-disabled', 'accountDisabled'],
    ['auth/account-exists-with-different-credential', 'providerMismatch'],
    ['auth/requires-recent-login', 'recentLoginRequired'],
    ['auth/something-new', 'unknown'],
    [null, 'unknown'],
  ])('%s → %s', (firebaseCode, expected) => {
    expect(authErrorCodeFor(firebaseCode)).toBe(expected);
  });

  it('does not tell a wrong password from an unknown account', () => {
    expect(authErrorCodeFor('auth/wrong-password')).toBe(authErrorCodeFor('auth/user-not-found'));
  });
});

describe('toAuthError', () => {
  it.each([
    ['auth/email-already-in-use', EmailAlreadyInUseError],
    ['auth/invalid-credential', InvalidCredentialsError],
    ['auth/too-many-requests', TooManyAttemptsError],
    ['auth/internal-error', AuthError],
  ])('turns %s into a named domain error that keeps the cause', (code, expectedClass) => {
    const original = firebaseError(code);
    const translated = toAuthError(original);

    expect(translated).toBeInstanceOf(expectedClass);
    expect(translated.cause).toBe(original);
  });
});

describe('isPopupUnavailable', () => {
  it('is true only when a popup cannot be shown at all', () => {
    expect(isPopupUnavailable(firebaseError('auth/popup-blocked'))).toBe(true);
    expect(
      isPopupUnavailable(firebaseError('auth/operation-not-supported-in-this-environment')),
    ).toBe(true);
    expect(isPopupUnavailable(firebaseError('auth/popup-closed-by-user'))).toBe(false);
    expect(isPopupUnavailable(new Error('other'))).toBe(false);
  });
});

describe('toDataError and guarded', () => {
  it('translates permission and connection failures', () => {
    expect(toDataError(firebaseError('permission-denied'))).toBeInstanceOf(PermissionDeniedError);
    expect(toDataError(firebaseError('unavailable'))).toBeInstanceOf(OfflineError);
  });

  it('leaves unknown failures and domain errors untouched', () => {
    const bug = new TypeError('bug');
    const domain = new SlugTakenError('gas-demo');
    expect(toDataError(bug)).toBe(bug);
    expect(toDataError(domain)).toBe(domain);
  });

  it('returns the value of a successful operation', async () => {
    await expect(guarded(() => Promise.resolve(7))).resolves.toBe(7);
  });

  it('rethrows a refused operation as a domain error', async () => {
    const refused = () => Promise.reject(firebaseError('permission-denied'));
    await expect(guarded(refused)).rejects.toBeInstanceOf(PermissionDeniedError);
  });
});

// PLAN 2.11 (defect found by flow-tester): an operation that needs the server never waits for ever.
describe('withDeadline', () => {
  const never = () => new Promise<never>(() => {});

  it('hands back the result of an operation that answers in time', async () => {
    await expect(withDeadline(1_000, async () => 'saved')).resolves.toBe('saved');
  });

  it('fails with OfflineError when the operation does not answer in time', async () => {
    await expect(withDeadline(5, never)).rejects.toBeInstanceOf(OfflineError);
  });

  it('passes on the failure of the operation itself', async () => {
    const refused = new Error('refused');

    await expect(withDeadline(1_000, () => Promise.reject(refused))).rejects.toBe(refused);
  });

  it('tells the operation that its deadline passed, so it can stop before its last step', async () => {
    let wasExpiredAtLastStep: boolean | null = null;
    const slow = async (hasExpired: () => boolean) => {
      await new Promise((resolve) => setTimeout(resolve, 30));
      wasExpiredAtLastStep = hasExpired();
    };

    await expect(withDeadline(5, slow)).rejects.toBeInstanceOf(OfflineError);
    await new Promise((resolve) => setTimeout(resolve, 60));

    expect(wasExpiredAtLastStep).toBe(true);
  });

  it('does not report an expiry to an operation that is on time', async () => {
    await expect(withDeadline(1_000, async (hasExpired) => hasExpired())).resolves.toBe(false);
  });
});
