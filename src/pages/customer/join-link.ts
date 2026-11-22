import { useState } from 'react';
import { useLocation } from 'react-router';
import { parseInviteFragment } from '@/domain/staff/invite';
import { useSignOut } from '@/features/account/use-sign-out';
import { ROUTES, signInPathFrom, withFragment } from '@/lib/routes';

/**
 * The fragment of the invitation link, kept in memory once the address bar no longer shows it
 * (PLAN §11, 2026-10-16). Another invitation link opened in the same tab replaces it; a fragment
 * that is not one does not: "Saltar al contenido" (`#contenido`) must not lose the invitation.
 */
export function useKeptInviteHash(): string {
  const { hash } = useLocation();
  const [kept, setKept] = useState(hash);
  if (hash !== kept && parseInviteFragment(hash) !== null) setKept(hash);
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
