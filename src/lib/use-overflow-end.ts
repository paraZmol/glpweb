import { type RefObject, useEffect, useState } from 'react';

/** Below a pixel the row is taken as scrolled to its end (zoom leaves fractions). */
const END_SLACK_PX = 1;

/**
 * Whether a row that scrolls sideways hides something past its right edge, so the screen can
 * fade that edge: chips that do not fit must not look like all there is.
 */
export function useOverflowEnd(ref: RefObject<HTMLElement | null>): boolean {
  const [hasMore, setHasMore] = useState(false);
  useEffect(() => {
    const row = ref.current;
    if (!row) return undefined;
    const measure = () =>
      setHasMore(row.scrollLeft + row.clientWidth < row.scrollWidth - END_SLACK_PX);
    measure();
    row.addEventListener('scroll', measure, { passive: true });
    const observer = new ResizeObserver(measure);
    observer.observe(row);
    return () => {
      row.removeEventListener('scroll', measure);
      observer.disconnect();
    };
  }, [ref]);
  return hasMore;
}
