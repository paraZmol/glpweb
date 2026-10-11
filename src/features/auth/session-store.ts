import { onSessionChanged } from '../../data/auth-repo';
import { hasLeftoverSessionData, noteSessionStarted } from '../../data/session-data';
import {
  hasSessionEnded,
  leftDataBehind,
  type Session,
  type SessionState,
} from '../../domain/auth/session';
import { handleSessionLost } from '../account/end-session';

// One subscription to Firebase Auth for the whole app, shared by every `useSession()`.
let state: SessionState = { status: 'loading' };
let stopListening: (() => void) | null = null;
let shownUid: string | null = null;
let isFirstState = true;
const listeners = new Set<() => void>();

/** Whether this page load starts signed out over what an earlier session left (PLAN 2.11). */
function startsOverLeftovers(session: Session | null): boolean {
  const opening = { isFirstState, isSignedIn: session !== null };
  isFirstState = false;
  // The marks are read only when the answer can depend on them.
  if (!opening.isFirstState || opening.isSignedIn) return false;
  return leftDataBehind({ ...opening, hasLocalSessionData: hasLeftoverSessionData() });
}

function receive(session: Session | null) {
  const nextUid = session?.uid ?? null;
  const hasEnded = hasSessionEnded(shownUid, nextUid) || startsOverLeftovers(session);
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
