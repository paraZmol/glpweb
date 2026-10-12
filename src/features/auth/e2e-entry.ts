import type { EmulatedGoogleIdentity } from '../../data/emulated-google';
import type { Session } from '../../domain/auth/session';

// TEST ONLY (PLAN 2.1). Browser tests cannot go through Google's window on every sign-in, so a
// build made for them (VITE_E2E_SIGN_IN=true, which `playwright.config.ts` sets together with
// the emulators) exposes this one function on `window`. `src/main.tsx` installs it behind that
// build-time switch: a production build drops this file, and `scripts/check-dist.mjs` refuses
// to deploy a folder where the name below appears. Even if it were there, it only works against
// the Auth emulator (`src/data/emulated-google.ts`).

declare global {
  interface Window {
    hornillaE2eSignIn?: (identity: EmulatedGoogleIdentity) => Promise<Session>;
  }
}

export function installE2eSignIn(): void {
  window.hornillaE2eSignIn = async (identity) => {
    const { signInWithEmulatedGoogle } = await import('../../data/emulated-google');
    return signInWithEmulatedGoogle(identity);
  };
}
