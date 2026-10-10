import { onSessionChanged } from '../../data/auth-repo';
import { noteSessionStarted } from '../../data/session-data';
import { hasSessionEnded, type Session, type SessionState } from '../../domain/auth/session';
import { handleSessionLost } from '../account/end-session';

// One subscription to Firebase Auth for the whole app, shared by every `useSession()`.
let state: SessionState = { status: 'loading' };
let stopListening: (() => void) | null = null;
let shownUid: string | null = null;
const listeners = new Set<() => void>();

function receive(session: Session | null) {
  const nextUid = session?.uid ?? null;
  const hasEnded = hasSessionEnded(shownUid, nextUid);
  shownUid = nextUid;
  // Token renewals of the same account arrive here too: marking twice changes nothing.
  if (session && !hasEnded) noteSessionStarted();
  state = session ? { status: 'signedIn', session } : { status: 'signedOut' };
  for (const notify of listeners) notify();
  // The data of the account that left must not stay on the device, however it left (PLAN 2.9).
  if (hasEnded) handleSessionLost();
}

function start() {
  stopListening = onSessionChanged(receive);
}

export function subscribeToSession(listener: () => void): () => void {
  listeners.add(listener);
  if (stopListening === null) start();
  return () => {
    listeners.delete(listener);
  };
}

export function getSessionState(): SessionState {
  return state;
}
