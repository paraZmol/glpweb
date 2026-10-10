import { useCallback, useEffect, useState } from 'react';

/**
 * Remote state always has these shapes (clean-code §4): screens render a skeleton for `loading`,
 * a message with retry for `error`, and decide what "empty" means from `data`.
 * `idle` means there is nothing to load yet (for example, nobody is signed in).
 */
export type AsyncResource<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; data: T }
  | { status: 'error'; error: unknown };

export type ReloadableResource<T> = AsyncResource<T> & { reload: () => void };

interface Settled<T> {
  key: string;
  attempt: number;
  resource: AsyncResource<T>;
}

/**
 * Loads once per `key` (a plain `getDocs`-style read, not a listener) and again on `reload()`.
 * Pass `key = null` while the inputs are not known. `load` may change identity freely: only the
 * key decides when to load again, and a slow answer for an old key is ignored.
 */
export function useAsyncResource<T>(
  key: string | null,
  load: () => Promise<T>,
): ReloadableResource<T> {
  const [attempt, setAttempt] = useState(0);
  const [settled, setSettled] = useState<Settled<T> | null>(null);

  useEffect(() => {
    if (key === null) return undefined;
    let isCurrent = true;
    const settle = (resource: AsyncResource<T>) => {
      if (isCurrent) setSettled({ key, attempt, resource });
    };
    load().then(
      (data) => settle({ status: 'ready', data }),
      (error: unknown) => settle({ status: 'error', error }),
    );
    return () => {
      isCurrent = false;
    };
    // `load` is deliberately left out: see the function comment.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt]);

  const reload = useCallback(() => setAttempt((current) => current + 1), []);

  if (key === null) return { status: 'idle', reload };
  const isFresh = settled !== null && settled.key === key && settled.attempt === attempt;
  return isFresh ? { ...settled.resource, reload } : { status: 'loading', reload };
}
