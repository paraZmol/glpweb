import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import type { Session } from '../domain/auth/session';
import { dropProviderPhoto, toSession } from './auth-repo';
import { auth } from './firebase';

// TEST ONLY. The Auth emulator accepts, in place of the token Google signs, a plain JSON text
// with the identity to pretend: that is how tests open a Google session without Google's window
// (PLAN 2.1). The real service rejects such a token, and this module refuses to run unless the
// app is connected to the emulator. No production code imports it: a production build does not
// carry it, and `scripts/check-dist.mjs` fails the deploy if its marker ever shows up in `dist`.

/** Looked for by `scripts/check-dist.mjs` and its test. Do not rename one without the other. */
export const EMULATED_SIGN_IN_MARKER = 'hornilla-emulated-google-sign-in';

/** What Google would say about the person. `sub` is the id Google gives the account. */
export interface EmulatedGoogleIdentity {
  sub: string;
  email: string;
  name: string;
  /** Google always confirms the address; false builds the session that should not exist. */
  emailVerified?: boolean;
}

/**
 * Signs in as that Google identity against the Auth emulator: the same session a person gets
 * from "Continuar con Google", account created on first use included.
 */
export async function signInWithEmulatedGoogle(identity: EmulatedGoogleIdentity): Promise<Session> {
  if (auth.emulatorConfig === null) {
    throw new Error(`${EMULATED_SIGN_IN_MARKER}: only against the Auth emulator`);
  }
  const idToken = JSON.stringify({
    sub: identity.sub,
    email: identity.email,
    email_verified: identity.emailVerified ?? true,
    name: identity.name,
  });
  const { user } = await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
  await dropProviderPhoto(user);
  return toSession(user);
}
