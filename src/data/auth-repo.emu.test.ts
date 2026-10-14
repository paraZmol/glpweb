import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { googleIdOf, SEED_USERS } from '../../tests/seed/data';
import { seedEmulators } from '../../tests/seed/seed';
import { signInAs, signInAsNewcomer } from '../../tests/support/emulated-session';
import { isAuthError } from '../domain/auth/errors';
import type { Session } from '../domain/auth/session';
import {
  currentSession,
  deleteOwnAccount,
  onSessionChanged,
  setSessionDisplayName,
  signOutSession,
} from './auth-repo';
import { signInWithEmulatedGoogle } from './emulated-google';
import { auth } from './firebase';

const NEWCOMER_EMAIL = 'recien-llegada@example.com';

beforeAll(async () => {
  await seedEmulators();
});

afterAll(async () => {
  await signOutSession();
});

// PLAN 2.1: sign-in is with Google only. The emulator pretends Google's answer; what is under
// test is everything the app does with the session it gets.
describe('auth repository against the emulator', () => {
  it('creates the account on the first sign-in, with the e-mail Google confirmed', async () => {
    const session = await signInAsNewcomer(NEWCOMER_EMAIL, 'R. Llegada');

    expect(session).toMatchObject({
      email: NEWCOMER_EMAIL,
      emailVerified: true,
      displayName: 'R. Llegada',
      providerIds: ['google.com'],
    });
    expect(currentSession()?.uid).toBe(session.uid);
  });

  it('finds the same account on the next sign-in', async () => {
    const first = await signInAsNewcomer(NEWCOMER_EMAIL);
    await signOutSession();

    const second = await signInAsNewcomer(NEWCOMER_EMAIL);

    expect(second.uid).toBe(first.uid);
  });

  it('signs in a seeded account under its own uid', async () => {
    const session = await signInAs(SEED_USERS.ownerA);

    expect(session).toMatchObject({
      uid: SEED_USERS.ownerA.uid,
      emailVerified: true,
      providerIds: ['google.com'],
    });
  });

  it('carries how the session came in, which is what the rules read', async () => {
    await signInAs(SEED_USERS.customer);

    const token = await auth.currentUser?.getIdTokenResult();

    expect(token?.signInProvider).toBe('google.com');
    expect(token?.claims.email_verified).toBe(true);
  });

  // PLAN 2.11: the photo Google hands over is not kept in the account.
  it('does not keep the photo Google hands over', async () => {
    await signOutSession();
    const idToken = JSON.stringify({
      sub: googleIdOf('con-foto@example.com'),
      email: 'con-foto@example.com',
      email_verified: true,
      name: 'F. Foto',
      picture: 'https://example.com/foto.png',
    });
    const { GoogleAuthProvider, signInWithCredential } = await import('firebase/auth');
    const { user } = await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
    expect(user.photoURL).toBe('https://example.com/foto.png');

    await signInWithEmulatedGoogle({
      sub: googleIdOf('con-foto@example.com'),
      email: 'con-foto@example.com',
      name: 'F. Foto',
    });

    expect(auth.currentUser?.photoURL).toBeNull();
    // Gone from the account itself, not only from what this tab remembers.
    await auth.currentUser?.reload();
    expect(auth.currentUser?.photoURL).toBeNull();
  });

  it('reports a session without a confirmed e-mail as such', async () => {
    const session = await signInAs(SEED_USERS.unverified);

    expect(session).toMatchObject({ uid: SEED_USERS.unverified.uid, emailVerified: false });
  });

  it('notifies subscribers on sign-in and sign-out', async () => {
    await signOutSession();
    const seen: (Session | null)[] = [];
    const unsubscribe = onSessionChanged((session) => seen.push(session));

    await signInAs(SEED_USERS.customer);
    await signOutSession();
    unsubscribe();

    // The sign-in can notify more than once (the photo is removed after it): what matters is
    // who was there, in order.
    const uids = seen.map((session) => session?.uid ?? null);
    expect(uids.filter((uid, index) => uid !== uids[index - 1])).toEqual([
      null,
      SEED_USERS.customer.uid,
      null,
    ]);
  });

  it('deletes the signed-in account, which can come back as a new one', async () => {
    const first = await signInAsNewcomer('se-va@example.com');

    await deleteOwnAccount();

    expect(currentSession()).toBeNull();
    const again = await signInAsNewcomer('se-va@example.com');
    expect(again.uid).not.toBe(first.uid);
  });

  it.each([
    ['delete the account', () => deleteOwnAccount()],
    ['rename the session', () => setSessionDisplayName('Nadie')],
  ])('refuses to %s without a session', async (_case, act) => {
    await signOutSession();

    const failure = await act().catch((error: unknown) => error);

    expect(isAuthError(failure, 'notSignedIn')).toBe(true);
  });
});
