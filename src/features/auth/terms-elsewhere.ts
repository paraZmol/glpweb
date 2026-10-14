import { useEffect } from 'react';
import { getUserProfile } from '../../data/users-repo';
import { needsTermsAcceptance } from '../../domain/legal/versions';

/** Tabs of the same browser tell each other; nothing is stored. */
const CHANNEL_NAME = 'hornilla-terms';

interface TermsAccepted {
  uid: string;
}

function isTermsAccepted(data: unknown): data is TermsAccepted {
  return typeof data === 'object' && data !== null && 'uid' in data && typeof data.uid === 'string';
}

let sharedChannel: BroadcastChannel | null | undefined;

/** One per tab, so a tab does not hear its own announcement. */
function channel(): BroadcastChannel | null {
  if (sharedChannel === undefined) {
    sharedChannel =
      typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(CHANNEL_NAME);
  }
  return sharedChannel;
}

/** Tells the other tabs of this browser that `uid` has just accepted the terms. */
export function announceTermsAccepted(uid: string): void {
  channel()?.postMessage({ uid } satisfies TermsAccepted);
}

/**
 * For the terms step: calls `onAccepted` when the same account accepted somewhere else, either
 * in another tab of this browser (it says so at once) or anywhere (checked when the tab comes
 * back into view). The profile is read only then, and `onAccepted` runs only if nothing is
 * pending any more: reloading the profile for nothing would wipe what the person typed.
 */
export function useTermsAcceptedElsewhere(uid: string, onAccepted: () => void): void {
  useEffect(() => {
    let isActive = true;
    const check = () =>
      getUserProfile(uid).then(
        (profile) => {
          if (isActive && !needsTermsAcceptance(profile)) onAccepted();
        },
        () => {
          // Offline or refused: the step stays, and its own button answers.
        },
      );
    const onMessage = (event: MessageEvent) => {
      if (isTermsAccepted(event.data) && event.data.uid === uid) void check();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void check();
    };
    channel()?.addEventListener('message', onMessage);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      isActive = false;
      channel()?.removeEventListener('message', onMessage);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [uid, onAccepted]);
}
