import { useEffect, useRef } from 'react';

/**
 * Moves the keyboard and the screen reader to an element as it appears (a heading with
 * `tabIndex={-1}`): a screen that replaces another says where the person is now.
 */
export function useFocusOnMount<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => ref.current?.focus({ preventScroll: true }), []);
  return ref;
}
