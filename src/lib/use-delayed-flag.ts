import { useEffect, useRef, useState } from 'react';
import { LOADING_FEEDBACK } from './motion';

/** How long a loading indicator shown at `shownAtMs` must still stay to avoid a flicker. */
export function remainingVisibleMs(shownAtMs: number, nowMs: number): number {
  return Math.max(0, LOADING_FEEDBACK.minVisibleMs - (nowMs - shownAtMs));
}

/**
 * The 300 ms rule of motion-system §2: the flag turns on only if `isActive` lasts longer than
 * 300 ms, and once on it stays at least 400 ms.
 */
export function useDelayedFlag(isActive: boolean): boolean {
  const [isShown, setShown] = useState(false);
  const shownAtMs = useRef(0);

  useEffect(() => {
    if (isActive === isShown) return undefined;
    const waitMs = isActive
      ? LOADING_FEEDBACK.delayMs
      : remainingVisibleMs(shownAtMs.current, Date.now());
    const timer = setTimeout(() => {
      if (isActive) shownAtMs.current = Date.now();
      setShown(isActive);
    }, waitMs);
    return () => clearTimeout(timer);
  }, [isActive, isShown]);

  return isShown;
}
