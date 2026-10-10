import { useCallback, useState } from 'react';
import { getDistributor } from '../../data/distributors-repo';
import { pickCurrentMembership } from '../../domain/tenancy/membership';
import { isWritable } from '../../domain/tenancy/status';
import type { Distributor, Member } from '../../domain/tenancy/types';
import { useAsyncResource } from '../../lib/use-async-resource';
import { useSignedInSession } from '../auth/use-session';
import { readRememberedDistributor, rememberDistributor } from './selection-storage';
import { useMyMemberships } from './use-my-memberships';

export type CurrentDistributor =
  /** Signed out. */
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; error: unknown; reload: () => void }
  /** Signed in, but not an active member of any distributor (a customer). */
  | { status: 'none'; memberships: Member[]; reload: () => void }
  | {
      status: 'ready';
      /** All memberships, for the selector. */
      memberships: Member[];
      /** The account's role in the selected distributor. */
      membership: Member;
      distributor: Distributor;
      /** False when suspended, past due or with the trial over: show it as read-only. */
      isWritable: boolean;
      select: (distributorId: string) => void;
      reload: () => void;
    };

/** Writability is judged when the distributor is loaded, not on every render. */
async function loadSelected(distributorId: string) {
  const distributor = await getDistributor(distributorId);
  return distributor && { distributor, isWritable: isWritable(distributor, new Date()) };
}

/** The choice made in this visit, falling back to the one remembered on this device. */
function useSelection(uid: string | null) {
  const [selection, setSelection] = useState<{ uid: string; distributorId: string } | null>(null);
  const select = useCallback(
    (distributorId: string) => {
      if (!uid) return;
      rememberDistributor(uid, distributorId);
      setSelection({ uid, distributorId });
    },
    [uid],
  );
  const chosenNow = selection && selection.uid === uid ? selection.distributorId : null;
  const rememberedId = chosenNow ?? (uid ? readRememberedDistributor(uid) : null);
  return { rememberedId, select };
}

/**
 * The distributor the panels work on (PLAN 2.4): the one remembered on this device if the
 * account is still an active member there, otherwise its first active membership. `select()`
 * switches and remembers. Costs the memberships query plus one read of the distributor.
 */
export function useCurrentDistributor(): CurrentDistributor {
  const uid = useSignedInSession()?.uid ?? null;
  const memberships = useMyMemberships();
  const { rememberedId, select } = useSelection(uid);

  const list = memberships.status === 'ready' ? memberships.data : [];
  const membership = pickCurrentMembership(list, rememberedId);
  const distributorId = membership?.distributorId ?? null;
  const distributor = useAsyncResource(distributorId, () => loadSelected(distributorId ?? ''));

  const reloadMemberships = memberships.reload;
  const reloadDistributor = distributor.reload;
  const reload = useCallback(() => {
    reloadMemberships();
    reloadDistributor();
  }, [reloadMemberships, reloadDistributor]);

  if (memberships.status === 'idle') return { status: 'idle' };
  if (memberships.status === 'loading') return { status: 'loading' };
  if (memberships.status === 'error') return { status: 'error', error: memberships.error, reload };
  if (membership === null) return { status: 'none', memberships: list, reload };
  if (distributor.status === 'error') return { status: 'error', error: distributor.error, reload };
  if (distributor.status !== 'ready') return { status: 'loading' };
  if (distributor.data === null) {
    return {
      status: 'error',
      error: new Error('The selected distributor no longer exists'),
      reload,
    };
  }
  return {
    status: 'ready',
    memberships: list,
    membership,
    distributor: distributor.data.distributor,
    isWritable: distributor.data.isWritable,
    select,
    reload,
  };
}
