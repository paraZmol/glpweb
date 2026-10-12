import { useSyncExternalStore } from 'react';
import type { Session, SessionState } from '../../domain/auth/session';
import { getSessionState, subscribeToSession } from './session-store';

/**
 * The signed-in account: `loading` until Firebase restores the session, then `signedOut` or
 * `signedIn`. It never carries a role: roles come from `useMyMemberships`.
 */
export function useSession(): SessionState {
  return useSyncExternalStore(subscribeToSession, getSessionState, getSessionState);
}

/** The session when signed in, otherwise null (also while loading). */
export function useSignedInSession(): Session | null {
  const state = useSession();
  return state.status === 'signedIn' ? state.session : null;
}
