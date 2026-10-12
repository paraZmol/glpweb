import { useCallback, useEffect, useState } from 'react';
import type { AsyncResource, ReloadableResource } from './use-async-resource';

/**
 * Starts listening and returns how to stop. `emit` may run any number of times; after `fail`
 * nothing else is expected (the source stopped by itself).
 */
export type Subscribe<T> = (emit: (data: T) => void, fail: (error: unknown) => void) => () => void;

interface Settled<T> {
  key: string;
  attempt: number;
  resource: AsyncResource<T>;
}

/**
 * The live twin of `useAsyncResource`: listens while it is mounted with a `key`, and stops when
 * the key changes or the component goes away. Same shapes for the screens (`loading` until the
 * first value, `error` when the source fails); `reload()` listens again from scratch, which is
 * how a failed source is retried. Pass `key = null` to listen to nothing. `subscribe` may change
 * identity freely: only the key decides when to start over.
 */
export function useLiveResource<T>(
  key: string | null,
  subscribe: Subscribe<T>,
): ReloadableResource<T> {
  const [attempt, setAttempt] = useState(0);
  const [settled, setSettled] = useState<Settled<T> | null>(null);

  useEffect(() => {
    if (key === null) return undefined;
    let isCurrent = true;
    const settle = (resource: AsyncResource<T>) => {
      if (isCurrent) setSettled({ key, attempt, resource });
    };
    const stop = subscribe(
      (data) => settle({ status: 'ready', data }),
      (error) => settle({ status: 'error', error }),
    );
    return () => {
      isCurrent = false;
      stop();
    };
    // `subscribe` is deliberately left out: see the function comment.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt]);

  const reload = useCallback(() => setAttempt((current) => current + 1), []);

  if (key === null) return { status: 'idle', reload };
  const isFresh = settled !== null && settled.key === key && settled.attempt === attempt;
  return isFresh ? { ...settled.resource, reload } : { status: 'loading', reload };
}
