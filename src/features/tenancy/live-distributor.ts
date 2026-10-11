import { useEffect, useSyncExternalStore } from 'react';

// How many screens on display need the selected distributor live. `useCurrentDistributor` runs
// once for the whole app (AccountProvider), also under pages that have nothing to do with a
// distributor: it only keeps listeners open while this count is above zero.
let screens = 0;
const listeners = new Set<() => void>();

function change(by: number): void {
  screens += by;
  for (const notify of listeners) notify();
}

function subscribe(notify: () => void): () => void {
  listeners.add(notify);
  return () => {
    listeners.delete(notify);
  };
}

/** For `useCurrentDistributor` only. */
export function useIsDistributorWatched(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => screens > 0,
    () => false,
  );
}

/**
 * Call it from a screen (or the shell of an area) that shows where the distributor stands: for
 * as long as it is mounted, `useAccount().current` follows the public profile, the control
 * document and the member document of the account live — a decision of the platform, a
 * suspension or a change of role reach the screen without reloading it (PLAN 2.11).
 * Cost while mounted: 3 listeners on single documents (3 reads to start, plus up to 2 by the
 * rules unless the account is the founder; then one read per document that changes). They close
 * when the last screen that asked for them goes away.
 */
export function useLiveDistributor(): void {
  useEffect(() => {
    change(1);
    return () => change(-1);
  }, []);
}
