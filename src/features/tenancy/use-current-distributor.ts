import { useCallback, useState } from 'react';
import {
  getStaffDistributor,
  syncAcceptingOrders,
  syncMemberDistributorName,
} from '../../data/distributors-repo';
import { isOpenToPublic, type ListingState, listingStateOf } from '../../domain/tenancy/listing';
import { pickCurrentMembership } from '../../domain/tenancy/membership';
import { isWritable } from '../../domain/tenancy/status';
import type { Distributor, Member } from '../../domain/tenancy/types';
import { useAsyncResource } from '../../lib/use-async-resource';
import { useSignedInSession } from '../auth/use-session';
import { readRememberedDistributor, rememberDistributor } from './selection-storage';
import { useMyMemberships } from './use-my-memberships';
import { forgetVisibleDistributors } from './visible-distributors';

export type CurrentDistributor =
  /** Signed out. */
  | { status: 'idle' }
  /**
   * `membership` is set as soon as the memberships are known, while the distributor itself is
   * still on its way: the role is already certain, so the area can stay on screen (PLAN 2.9).
   */
  | { status: 'loading'; membership?: Member; memberships?: Member[] }
  | { status: 'error'; error: unknown; reload: () => void }
  /** Signed in, but not an active member of any distributor (a customer). */
  | { status: 'none'; memberships: Member[]; reload: () => void }
  | {
      status: 'ready';
      /** All memberships, for the selector. Each one carries `distributorName`. */
      memberships: Member[];
      /** The account's role in the selected distributor. */
      membership: Member;
      /** Public profile plus plan state (status, trial end), which only the staff may read. */
      distributor: Distributor;
      /** False when suspended, past due or with the trial over: show it as read-only. */
      isWritable: boolean;
      /**
       * Where it stands with the review of the platform (PLAN 2.11): `inReview` (visitors do
       * not see it yet), `changesRequested` (read `distributor.reviewNote`), `listed`, or
       * `notOperating` (approved but read-only).
       */
      listing: ListingState;
      select: (distributorId: string) => void;
      reload: () => void;
    };

/**
 * Two copies follow the distributor and nobody updates them when time passes or a name
 * changes: the public "takes orders" flag (it may operate and its listing is approved) and the
 * name kept in the member document. Whoever of
 * the staff opens the panel puts them right. The rules only accept the true value, and a
 * failure here changes nothing the person sees, so it is not awaited.
 */
function repairCopies(distributor: Distributor, membership: Member, isOpen: boolean): void {
  if (distributor.acceptingOrders !== isOpen) {
    syncAcceptingOrders(distributor.id, isOpen).then(forgetVisibleDistributors, () => {});
  }
  if (membership.distributorName !== distributor.name) {
    syncMemberDistributorName(distributor.id, membership.uid, distributor.name).catch(() => {});
  }
}

/** Writability is judged when the distributor is loaded, not on every render. */
async function loadSelected(membership: Member) {
  const distributor = await getStaffDistributor(membership.distributorId);
  if (!distributor) return null;
  const now = new Date();
  repairCopies(distributor, membership, isOpenToPublic(distributor, now));
  return {
    distributor,
    isWritable: isWritable(distributor, now),
    listing: listingStateOf(distributor, now),
  };
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
 * switches and remembers; while the newly chosen distributor loads, the state is `loading`
 * WITH the chosen membership.
 * Cost: the memberships query, then two reads (public profile and control document) plus one
 * by the rules unless the account is the founder.
 */
export function useCurrentDistributor(): CurrentDistributor {
  const uid = useSignedInSession()?.uid ?? null;
  const memberships = useMyMemberships();
  const { rememberedId, select } = useSelection(uid);

  const list = memberships.status === 'ready' ? memberships.data : [];
  const membership = pickCurrentMembership(list, rememberedId);
  const distributorId = membership?.distributorId ?? null;
  const distributor = useAsyncResource(distributorId, () =>
    membership ? loadSelected(membership) : Promise.resolve(null),
  );

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
  if (distributor.status !== 'ready') return { status: 'loading', membership, memberships: list };
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
    listing: distributor.data.listing,
    select,
    reload,
  };
}
