// How repository tests open a session (PLAN 2.1): as a Google identity the Auth emulator
// pretends, the same kind of session the app gets from "Continuar con Google". Emulators only.
import { signInWithEmulatedGoogle } from '../../src/data/emulated-google';
import { auth } from '../../src/data/firebase';
import type { Session } from '../../src/domain/auth/session';
import { googleIdOf } from '../seed/data';

/** Enough of an account to sign in as it: a seeded one, or one a test makes up. */
export interface TestIdentity {
  email: string;
  displayName: string;
  /** False pretends a Google answer without a confirmed address. Default true. */
  emailVerified?: boolean;
}

/**
 * Signs in as that person. A seeded account keeps its uid (the seed linked it to the same
 * Google id); any other e-mail gets a new account on its first sign-in, like a real newcomer.
 */
export function signInAs(identity: TestIdentity): Promise<Session> {
  return signInWithEmulatedGoogle({
    sub: googleIdOf(identity.email),
    email: identity.email,
    name: identity.displayName,
    emailVerified: identity.emailVerified,
  });
}

/** A first sign-in with an e-mail nobody used: an account with no profile. */
export function signInAsNewcomer(email: string, displayName = 'Z. Prueba'): Promise<Session> {
  return signInAs({ email, displayName });
}

/**
 * Asks the server about the account again and renews its token: what happens by itself within
 * the hour. Throws when the session is no longer good (sessions revoked, account deleted).
 */
export async function renewSession(): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('renewSession: nobody is signed in');
  await user.reload();
  await user.getIdToken(true);
}
