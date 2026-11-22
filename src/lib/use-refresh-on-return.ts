import { useEffect, useRef } from 'react';

/** The focus and "visible" events of one return arrive together: they count once. */
export const RETURN_REFRESH_GAP_MS = 1_000;

/**
 * For lists that cost many reads per load (the plant stock and its log: about 50): somebody who
 * switches windows all day would otherwise pay them at every return. A change made meanwhile
 * shows on the first return after this long, or at once after the person's own write.
 */
export const COSTLY_RETURN_REFRESH_GAP_MS = 60_000;

/** Whether a return at `now` is too close to the one that loaded at `lastAt`. */
export function isReturnTooSoon(now: number, lastAt: number, minGapMs: number): boolean {
  return now - lastAt < minGapMs;
}

/**
 * Calls `refresh` when the person comes back to this screen: the tab becomes visible again
 * (another tab, another app on a phone) or the window takes the focus back (another window on
 * a desktop). Lists that are read once and not followed live (catalogue, staff) catch up with
 * what changed elsewhere in the meantime, at the price of one load per return instead of a
 * listener open all day (PLAN §11, 2026-10-15). Returns closer than `minGapMs` (by default
 * `RETURN_REFRESH_GAP_MS`) to the previous one load nothing. Pass `isEnabled = false` while
 * there is nothing to load.
 */
export function useRefreshOnReturn(
  refresh: () => void,
  isEnabled = true,
  minGapMs = RETURN_REFRESH_GAP_MS,
): void {
  const latest = useRef(refresh);
  useEffect(() => {
    latest.current = refresh;
  }, [refresh]);

  useEffect(() => {
    if (!isEnabled) return undefined;
    let lastAt = Number.NEGATIVE_INFINITY;
    const onReturn = () => {
      if (document.visibilityState !== 'visible' || !navigator.onLine) return;
      const now = Date.now();
      if (isReturnTooSoon(now, lastAt, minGapMs)) return;
      lastAt = now;
      latest.current();
    };
    document.addEventListener('visibilitychange', onReturn);
    window.addEventListener('focus', onReturn);
    return () => {
      document.removeEventListener('visibilitychange', onReturn);
      window.removeEventListener('focus', onReturn);
    };
  }, [isEnabled, minGapMs]);
}
