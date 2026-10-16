import { useEffect } from 'react';
import { useLocation } from 'react-router';

/**
 * Brings the section named in the URL fragment into view once the page is on screen. Needed when
 * arriving from another page (`/#seguridad`): the page enters with a transition, after the
 * router has already tried to scroll.
 */
export function useScrollToHash(): void {
  const { hash } = useLocation();
  useEffect(() => {
    const id = decodeURIComponent(hash.replace(/^#/, ''));
    if (!id) return;
    const frame = requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView());
    return () => cancelAnimationFrame(frame);
  }, [hash]);
}
