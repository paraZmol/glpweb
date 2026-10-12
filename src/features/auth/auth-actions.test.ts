import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authErrorFor, isAuthError } from '../../domain/auth/errors';
import * as authRepo from '../../data/auth-repo';
import { requestPasswordReset } from './auth-actions';

vi.mock('../../data/auth-repo');
vi.mock('../../data/users-repo');
const repo = vi.mocked(authRepo);

beforeEach(() => {
  repo.sendPasswordReset.mockReset();
});

// PLAN 2.1. role-walker 2026-10-11: /restablecer told an address without an account apart.
describe('requestPasswordReset', () => {
  it('asks for the e-mail of the address as the account wrote it, without case or spaces', async () => {
    repo.sendPasswordReset.mockResolvedValue();

    await requestPasswordReset('  Persona@Example.com ');

    expect(repo.sendPasswordReset).toHaveBeenCalledWith('persona@example.com');
  });

  it('answers an address without an account exactly like a known one', async () => {
    repo.sendPasswordReset.mockRejectedValue(authErrorFor('invalidCredentials'));

    await expect(requestPasswordReset('nadie@example.com')).resolves.toBeUndefined();
  });

  it.each(['network', 'tooManyAttempts', 'unknown'] as const)(
    'still reports what is not about the account: %s',
    async (code) => {
      repo.sendPasswordReset.mockRejectedValue(authErrorFor(code));

      await expect(requestPasswordReset('persona@example.com')).rejects.toSatisfy((error) =>
        isAuthError(error, code),
      );
    },
  );

  it('refuses a text that is not an address before asking anything', async () => {
    await expect(requestPasswordReset('sin-arroba')).rejects.toSatisfy((error) =>
      isAuthError(error, 'invalidEmail'),
    );
    expect(repo.sendPasswordReset).not.toHaveBeenCalled();
  });
});
