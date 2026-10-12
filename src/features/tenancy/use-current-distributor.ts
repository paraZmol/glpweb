import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { syncAcceptingOrders, syncMemberDistributorName } from '../../data/distributors-repo';
import { isOpenToPublic, type ListingState, listingStateOf } from '../../domain/tenancy/listing';
import { hasStandingChanged, pickCurrentMembership } from '../../domain/tenancy/membership';
import { isWritable } from '../../domain/tenancy/status';
import type { Distributor, Member } from '../../domain/tenancy/types';
import { useSignedInSession } from '../auth/use-session';
import { readRememberedDistributor, rememberDistributor } from './selection-storage';
import { useMyMemberships } from './use-my-memberships';
import { type StaffDistributorView, useStaffDistributor } from './use-staff-distributor';
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
       * not see it yet), `changesRequested` (read `distributor.reviewNote`), `correctionsSent`
       * (the owner answered that note at `distributor.correctedAt` and waits again; the note
       * is still there), `listed`, or `notOperating` (approved but read-only).
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

/** Writability is judged when the distributor arrives (or changes), not on every render. */
function judge(distributor: Distributor) {
  const now = new Date();
  return {
    isOpen: isOpenToPublic(distributor, now),
    isWritable: isWritable(distributor, now),
    listing: listingStateOf(distributor, now),
  };
}

/** Puts the two copies right once per distributor shown, not on every change that arrives. */
function useRepairedCopies(view: StaffDistributorView | null, membership: Member | null): void {
  const repairedId = useRef<string | null>(null);
  useEffect(() => {
    if (!view || !membership || repairedId.current === view.distributor.id) return;
    repairedId.current = view.distributor.id;
    repairCopies(view.distributor, membership, judge(view.distributor).isOpen);
  }, [view, membership]);
}

/**
 * While the distributor is followed live, the member document of the account comes with it: if
 * its role changed or it was deactivated under the open session, the memberships are read again
 * and the guards act on what they say now. Once per change that arrives.
 */
function useStandingWatch(
  membership: Member | null,
  current: Member | null | undefined,
  reloadMemberships: () => void,
): void {
  const judged = useRef<Member | null | undefined>(undefined);
  useEffect(() => {
    if (membership === null || current === undefined || judged.current === current) return;
    judged.current = current;
    if (hasStandingChanged(membership, current)) reloadMemberships();
  }, [membership, current, reloadMemberships]);
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
 * It runs once for the whole app. By itself it reads once; while a screen that called
 * `useLiveDistributor()` is mounted it follows the public profile, the control document and the
 * member document of the account live, so a decision of the platform, a suspension or a change
 * of role show without reloading (PLAN 2.11).
 * Cost: the memberships query, then two reads (public profile and control document) plus one
 * by the rules unless the account is the founder; live, see `useLiveDistributor`.
 */
export function useCurrentDistributor(): CurrentDistributor {
  const uid = useSignedInSession()?.uid ?? null;
  const memberships = useMyMemberships();
  const { rememberedId, select } = useSelection(uid);

  const list = memberships.status === 'ready' ? memberships.data : [];
  const membership = pickCurrentMembership(list, rememberedId);
  const distributor = useStaffDistributor(membership);
  const view = distributor.status === 'ready' ? distributor.data : null;
  const judged = useMemo(() => (view ? judge(view.distributor) : null), [view]);

  const reloadMemberships = memberships.reload;
  useRepairedCopies(view, membership);
  useStandingWatch(membership, view?.member, reloadMemberships);
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
  if (view === null || judged === null) {
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
    distributor: view.distributor,
    isWritable: judged.isWritable,
    listing: judged.listing,
    select,
    reload,
  };
}
