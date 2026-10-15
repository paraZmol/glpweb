import { useCallback, useState } from 'react';
import { getStaffDistributor, watchStaffDistributor } from '../../data/distributors-repo';
import type { Distributor, Member } from '../../domain/tenancy/types';
import { type ReloadableResource, useAsyncResource } from '../../lib/use-async-resource';
import { useLiveResource } from '../../lib/use-live-resource';
import { useIsDistributorWatched } from './live-distributor';

export interface StaffDistributorView {
  distributor: Distributor;
  /**
   * The member document of the account as it stands now, or null if it is gone. Only known
   * while the distributor is followed live; left out after a plain read.
   */
  member?: Member | null;
}

interface Kept {
  distributorId: string;
  view: StaffDistributorView | null;
}

interface Failure {
  distributorId: string;
  error: unknown;
}

/**
 * The distributor of `membership` as its staff sees it. Read once (two reads) while no screen
 * asked for it live; followed live (`useLiveDistributor`) while one does, and the last value
 * known stays when that screen leaves, so going back and forth reads nothing twice.
 * `data` is null when the distributor does not exist. `reload()` forgets what is known and reads
 * (or listens) again.
 */
export function useStaffDistributor(
  membership: Member | null,
): ReloadableResource<StaffDistributorView | null> {
  const isWatched = useIsDistributorWatched();
  const distributorId = membership?.distributorId ?? null;
  const uid = membership?.uid ?? '';
  const [kept, setKept] = useState<Kept | null>(null);
  // A live source that failed stays failed until `reload()`, also once no screen watches it: the
  // guard that shows the error unmounts the screen that watched, and falling back to the last
  // known view would mount it again, fail again, and loop (PLAN 3.2: access withdrawn live).
  const [failure, setFailure] = useState<Failure | null>(null);
  const known = kept !== null && kept.distributorId === distributorId ? kept : null;

  const live = useLiveResource<StaffDistributorView | null>(
    isWatched ? distributorId : null,
    (emit, fail) => watchStaffDistributor(distributorId ?? '', uid, emit, fail),
  );
  const once = useAsyncResource<StaffDistributorView | null>(
    isWatched || known ? null : distributorId,
    async () => {
      const distributor = await getStaffDistributor(distributorId ?? '');
      return distributor && { distributor };
    },
  );
  if (
    distributorId !== null &&
    live.status === 'error' &&
    failure?.distributorId !== distributorId
  ) {
    setFailure({ distributorId, error: live.error });
  }
  const failed = failure !== null && failure.distributorId === distributorId ? failure : null;
  const source = isWatched ? live : once;
  if (distributorId !== null && source.status === 'ready' && known?.view !== source.data) {
    setKept({ distributorId, view: source.data });
  }

  const reloadLive = live.reload;
  const reloadOnce = once.reload;
  const reload = useCallback(() => {
    setKept(null);
    setFailure(null);
    reloadLive();
    reloadOnce();
  }, [reloadLive, reloadOnce]);

  if (distributorId === null) return { status: 'idle', reload };
  if (failed) return { status: 'error', error: failed.error, reload };
  // A source that failed (access withdrawn, malformed document) is not papered over with what
  // was known before.
  if (source.status === 'error') return { ...source, reload };
  return known ? { status: 'ready', data: known.view, reload } : { status: 'loading', reload };
}
