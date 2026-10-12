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

const DESCRIPTION_SELECTOR = 'meta[name="description"]';

/**
 * Describes the screen to search engines and link previews while it is on display, and puts
 * the description of the site (index.html) back when it leaves. Screens without their own
 * description simply do not call it.
 */
export function usePageDescription(description: string): void {
  useEffect(() => {
    const meta = document.querySelector<HTMLMetaElement>(DESCRIPTION_SELECTOR);
    if (!meta || description === '') return undefined;
    const siteDescription = meta.content;
    meta.content = description;
    return () => {
      meta.content = siteDescription;
    };
  }, [description]);
}

export function useCurrentPageTitle(): string {
  return useSyncExternalStore(
    subscribe,
    () => currentTitle,
    () => '',
  );
}
