import { useSyncExternalStore } from 'react';

function subscribe(notify: () => void): () => void {
  window.addEventListener('online', notify);
  window.addEventListener('offline', notify);
  return () => {
    window.removeEventListener('online', notify);
    window.removeEventListener('offline', notify);
  };
}

/**
 * Whether the device reports a connection. `true` does not prove the internet works, but
 * `false` is certain: use it to explain why an action that needs the network is unavailable.
 */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
}
