import { useState } from 'react';
import { useLocation } from 'react-router';
import { useSignOut } from '@/features/account/use-sign-out';
import { ROUTES, signInPathFrom, withFragment } from '@/lib/routes';

/**
 * The fragment of the invitation link, kept in memory once the address bar no longer shows it
 * (PLAN §11, 2026-10-16). Any other link opened in the same tab replaces it, also a broken one,
 * which must then say it is incomplete; only the skip link's own anchor ("Saltar al contenido",
 * `#contenido`) keeps it, so that jumping to the content does not lose the invitation.
 */
const SKIP_LINK_HASH = '#contenido';

/** The fragment to keep once the address shows `hash`, having kept `kept` so far. */
export function nextKeptHash(kept: string, hash: string): string {
  return hash === '' || hash === SKIP_LINK_HASH ? kept : hash;
}

export function useKeptInviteHash(): string {
  const { hash } = useLocation();
  const [kept, setKept] = useState(hash);
  const next = nextKeptHash(kept, hash);
  if (next !== kept) setKept(next);
  return kept;
}

/**
 * Signs out to come back with another account: to the sign-in, then to this same invitation
 * (its code rides in the fragment, never in `desde`).
 */
export function useSwitchAccount(linkHash: string) {
  const { signOut, isSigningOut } = useSignOut(withFragment(signInPathFrom(ROUTES.join), linkHash));
  return { switchAccount: signOut, isSwitching: isSigningOut };
}
