import { useCallback, useState } from 'react';
import type { PlatformListFilter } from '../../domain/tenancy/listing';
import { useAsyncResource } from '../../lib/use-async-resource';
import { useSignedInSession } from '../auth/use-session';
import {
  type DistributorPage,
  type ListedDistributor,
  listDistributors,
  type PageCursor,
} from './platform-actions';

export type PlatformDistributors =
  | { status: 'loading'; reload: () => void }
  | { status: 'error'; error: unknown; reload: () => void }
  | {
      status: 'ready';
      /** Every row loaded so far, oldest first. */
      items: ListedDistributor[];
      hasMore: boolean;
      isLoadingMore: boolean;
      /** Why the last `loadMore()` failed; null otherwise. The rows already shown stay. */
      loadMoreError: unknown;
      loadMore: () => void;
      /** Starts again from the first page (after a decision the lists change). */
      reload: () => void;
    };

/** The pages loaded after the first one, tied to the first page they continue. */
interface Continuation {
  first: DistributorPage;
  items: ListedDistributor[];
  next: PageCursor | null;
  isLoading: boolean;
  error: unknown;
}

const startOf = (first: DistributorPage): Continuation => ({
  first,
  items: [],
  next: first.next,
  isLoading: false,
  error: null,
});

/**
 * The distributors of the platform in one standing (PLAN 2.11): `inReview` (they wait for a
 * decision), `approved` or `suspended`, oldest first, a page at a time. For the platform panel
 * only: any other account gets an error (`PermissionDeniedError`). `loading` while signed out.
 * Each row is the control document with `distributorName` and `slug` (null in documents older
 * than them). Changing the filter starts over.
 * Cost: one bounded query per page (one read per row plus one), no listener.
 */
export function usePlatformDistributors(filter: PlatformListFilter): PlatformDistributors {
  const uid = useSignedInSession()?.uid ?? null;
  const first = useAsyncResource(uid === null ? null : `${uid}:${filter}`, () =>
    listDistributors({ filter }),
  );
  const [continuation, setContinuation] = useState<Continuation | null>(null);
  const firstPage = first.status === 'ready' ? first.data : null;
  // Pages that continue an earlier first page (another filter, or before a reload) are stale.
  const more =
    firstPage === null
      ? null
      : continuation?.first === firstPage
        ? continuation
        : startOf(firstPage);

  const loadMore = useCallback(() => {
    if (more === null || more.isLoading || more.next === null) return;
    const settle = (result: Partial<Continuation>) =>
      setContinuation((latest) => (latest?.first === more.first ? { ...more, ...result } : latest));
    setContinuation({ ...more, isLoading: true, error: null });
    listDistributors({ filter, after: more.next }).then(
      (page) => settle({ items: [...more.items, ...page.items], next: page.next }),
      (error: unknown) => settle({ error }),
    );
  }, [filter, more]);

  if (first.status === 'error') return first;
  if (first.status !== 'ready' || more === null) return { status: 'loading', reload: first.reload };
  return {
    status: 'ready',
    items: [...first.data.items, ...more.items],
    hasMore: more.next !== null,
    isLoadingMore: more.isLoading,
    loadMoreError: more.error,
    loadMore,
    reload: first.reload,
  };
}
