import { useEffect, useRef } from 'react';

/** The focus and "visible" events of one return arrive together: they count once. */
export const RETURN_REFRESH_GAP_MS = 1_000;

/**
 * Calls `refresh` when the person comes back to this screen: the tab becomes visible again
 * (another tab, another app on a phone) or the window takes the focus back (another window on
 * a desktop). Lists that are read once and not followed live (catalogue, staff) catch up with
 * what changed elsewhere in the meantime, at the price of one load per return instead of a
 * listener open all day (PLAN §11, 2026-10-15). Returns closer than `RETURN_REFRESH_GAP_MS`
 * to the previous one load nothing. Pass `isEnabled = false` while there is nothing to load.
 */
export function useRefreshOnReturn(refresh: () => void, isEnabled = true): void {
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
      if (now - lastAt < RETURN_REFRESH_GAP_MS) return;
      lastAt = now;
      latest.current();
    };
    document.addEventListener('visibilitychange', onReturn);
    window.addEventListener('focus', onReturn);
    return () => {
      document.removeEventListener('visibilitychange', onReturn);
      window.removeEventListener('focus', onReturn);
    };
  }, [isEnabled]);
}
