import { useCallback, useSyncExternalStore } from 'react';

/** Tailwind's `lg:` breakpoint: where the layouts change from phone to desktop composition. */
export const DESKTOP_QUERY = '(min-width: 64rem)';

export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (notify: () => void) => {
      const media = window.matchMedia(query);
      media.addEventListener('change', notify);
      return () => media.removeEventListener('change', notify);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

export function useIsDesktop(): boolean {
  return useMediaQuery(DESKTOP_QUERY);
}
