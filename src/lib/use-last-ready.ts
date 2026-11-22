import { useState } from 'react';
import type { AsyncResource } from './use-async-resource';

interface Kept<T> {
  key: string | null;
  data: T;
}

/**
 * The data of `resource`, or the last data it had for the same `key` while it loads again after
 * `reload()`: a list refreshed after a change stays on screen instead of turning back into its
 * skeleton (motion-system §2). Another key (another distributor) never shows the old data. Null
 * until the first load arrives; `isRefreshing` is true while an old copy is on screen.
 */
export function useLastReady<T>(
  resource: AsyncResource<T>,
  key: string | null,
): { data: T | null; isRefreshing: boolean } {
  const [kept, setKept] = useState<Kept<T> | null>(null);
  if (resource.status === 'ready' && (kept?.key !== key || kept.data !== resource.data)) {
    // Adjusting state while rendering (React's documented pattern): no extra effect pass.
    setKept({ key, data: resource.data });
  }
  if (resource.status === 'ready') return { data: resource.data, isRefreshing: false };
  const old = kept?.key === key && resource.status === 'loading' ? kept.data : null;
  return { data: old, isRefreshing: old !== null };
}
