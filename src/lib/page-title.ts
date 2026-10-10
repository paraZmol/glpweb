import { useEffect, useSyncExternalStore } from 'react';

const APP_NAME = 'Hornilla';

// The title of the screen on display, shared so the route announcer can read it aloud.
let currentTitle = '';
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function documentTitleFor(title: string): string {
  return title ? `${title} · ${APP_NAME}` : APP_NAME;
}

/** Names the screen: browser tab, history entry and screen-reader announcement on arrival. */
export function usePageTitle(title: string): void {
  useEffect(() => {
    document.title = documentTitleFor(title);
    currentTitle = title;
    for (const notify of listeners) notify();
  }, [title]);
}

export function useCurrentPageTitle(): string {
  return useSyncExternalStore(
    subscribe,
    () => currentTitle,
    () => '',
  );
}
