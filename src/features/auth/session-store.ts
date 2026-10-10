import { onSessionChanged } from '../../data/auth-repo';
import type { SessionState } from '../../domain/auth/session';

// One subscription to Firebase Auth for the whole app, shared by every `useSession()`.
let state: SessionState = { status: 'loading' };
let stopListening: (() => void) | null = null;
const listeners = new Set<() => void>();

function start() {
  stopListening = onSessionChanged((session) => {
    state = session ? { status: 'signedIn', session } : { status: 'signedOut' };
    for (const notify of listeners) notify();
  });
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
