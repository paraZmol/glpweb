import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SEED_PASSWORD, SEED_USERS } from '../../tests/seed/data';
import { seedEmulators } from '../../tests/seed/seed';
import { markEmailVerified, sentAuthEmails } from '../../tests/support/emulator';
import {
  EmailAlreadyInUseError,
  InvalidCredentialsError,
  isAuthError,
  WeakPasswordError,
} from '../domain/auth/errors';
import type { Session } from '../domain/auth/session';
import {
  currentSession,
  onSessionChanged,
  refreshSession,
  registerWithEmail,
  resendVerificationEmail,
  sendPasswordReset,
  signInWithEmail,
  signOutSession,
} from './auth-repo';

const NEW_ACCOUNT = {
  email: 'registro-nuevo@example.com',
  password: SEED_PASSWORD,
  displayName: 'L. Registro',
};
const TOO_SHORT = '123';

const typesSentTo = async (email: string) =>
  (await sentAuthEmails()).filter((mail) => mail.email === email).map((mail) => mail.requestType);

beforeAll(async () => {
  await seedEmulators();
});

afterAll(async () => {
  await signOutSession();
});

// PLAN 2.1
describe('auth repository against the emulator', () => {
  it('registers an unverified account, signs it in and sends the verification e-mail', async () => {
    const session = await registerWithEmail(NEW_ACCOUNT);

    expect(session).toMatchObject({
      email: NEW_ACCOUNT.email,
      emailVerified: false,
      displayName: NEW_ACCOUNT.displayName,
      providerIds: ['password'],
    });
    expect(currentSession()?.uid).toBe(session.uid);
    expect(await typesSentTo(NEW_ACCOUNT.email)).toEqual(['VERIFY_EMAIL']);
  });

  it('sees the verified e-mail only after refreshing the session', async () => {
    const session = await signInWithEmail(NEW_ACCOUNT.email, NEW_ACCOUNT.password);
    await markEmailVerified(session.uid);

    expect(currentSession()?.emailVerified).toBe(false);
    const refreshed = await refreshSession();

    expect(refreshed?.emailVerified).toBe(true);
  });

  it('can send the verification e-mail again', async () => {
    await signInWithEmail(SEED_USERS.unverified.email, SEED_PASSWORD);

    await resendVerificationEmail();

    expect(await typesSentTo(SEED_USERS.unverified.email)).toEqual(['VERIFY_EMAIL']);
  });

  it('rejects registering an e-mail that already has an account', async () => {
    const duplicate = { ...NEW_ACCOUNT, email: SEED_USERS.customer.email };
    await expect(registerWithEmail(duplicate)).rejects.toBeInstanceOf(EmailAlreadyInUseError);
  });

  it('rejects a password that Firebase considers too weak', async () => {
    const weak = { ...NEW_ACCOUNT, email: 'otra@example.com', password: TOO_SHORT };
    await expect(registerWithEmail(weak)).rejects.toBeInstanceOf(WeakPasswordError);
  });

  it('signs in a seeded account', async () => {
    const session = await signInWithEmail(SEED_USERS.ownerA.email, SEED_PASSWORD);

    expect(session).toMatchObject({ uid: SEED_USERS.ownerA.uid, emailVerified: true });
  });

  it.each([
    ['a wrong password', SEED_USERS.ownerA.email],
    ['an unknown account', 'nadie@example.com'],
  ])('rejects %s with the same error, so accounts cannot be probed', async (_case, email) => {
    await expect(signInWithEmail(email, 'no-es-la-correcta')).rejects.toBeInstanceOf(
      InvalidCredentialsError,
    );
  });

  it('sends a password reset e-mail', async () => {
    await sendPasswordReset(SEED_USERS.customer.email);

    expect(await typesSentTo(SEED_USERS.customer.email)).toEqual(['PASSWORD_RESET']);
  });

  it('notifies subscribers on sign-in and sign-out', async () => {
    await signOutSession();
    const seen: (Session | null)[] = [];
    const unsubscribe = onSessionChanged((session) => seen.push(session));

    await signInWithEmail(SEED_USERS.customer.email, SEED_PASSWORD);
    await signOutSession();
    unsubscribe();

    expect(seen.map((session) => session?.uid ?? null)).toEqual([
      null,
      SEED_USERS.customer.uid,
      null,
    ]);
  });

  it('refuses to resend the verification e-mail without a session', async () => {
    await signOutSession();

    const failure = await resendVerificationEmail().catch((error: unknown) => error);

    expect(isAuthError(failure, 'notSignedIn')).toBe(true);
    expect(await refreshSession()).toBeNull();
  });
});
