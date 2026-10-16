import { listHelpers } from '../../data/helpers-repo';
import { getInvite, listPendingInvites, listStaff } from '../../data/staff-repo';
import type { Helper } from '../../domain/staff/helper';
import type { Invite, InviteRef } from '../../domain/staff/invite';
import type { Member } from '../../domain/tenancy/types';
import { type ReloadableResource, useAsyncResource } from '../../lib/use-async-resource';
import { useRefreshOnReturn } from '../../lib/use-refresh-on-return';

// Not live: one query per load, when the screen opens and each time the person comes back to it
// (`useRefreshOnReturn`: somebody who joined, an invitation used meanwhile); call `reload()`
// after a write. Pass null while the distributor is not known.

/** A list of the staff screen, read again when the person comes back to the screen. */
function useStaffList<T>(key: string | null, load: () => Promise<T>): ReloadableResource<T> {
  const list = useAsyncResource(key, load);
  useRefreshOnReturn(list.reload, key !== null);
  return list;
}

/**
 * The staff of a distributor, active or not, sorted (active first, owners first). Owner and
 * dispatcher only. One read per member, plus 1 by the rules.
 */
export function useStaff(distributorId: string | null): ReloadableResource<Member[]> {
  return useStaffList(distributorId && `staff:${distributorId}`, () =>
    listStaff(distributorId ?? ''),
  );
}

/**
 * Owner only: the invitations that wait, newest first (`inviteStateOf` tells the ones past
 * their days). One read per invitation, plus 1 by the rules.
 */
export function usePendingInvites(distributorId: string | null): ReloadableResource<Invite[]> {
  return useStaffList(distributorId && `invites:${distributorId}`, () =>
    listPendingInvites(distributorId ?? ''),
  );
}

/**
 * The helpers of a distributor, active first. Its whole staff reads them. One read per helper,
 * plus 1 by the rules.
 */
export function useHelpers(distributorId: string | null): ReloadableResource<Helper[]> {
  return useStaffList(distributorId && `helpers:${distributorId}`, () =>
    listHelpers(distributorId ?? ''),
  );
}

/**
 * The invitation of a link (`parseInviteFragment(location.hash)`), for the screen that joins:
 * where, as what and whether it can still be used (`inviteStateOf`). Null data when no
 * invitation has that code. Needs a session (Google). One read.
 */
export function useInvite(ref: InviteRef | null): ReloadableResource<Invite | null> {
  const key = ref && `invite:${ref.distributorId}:${ref.code}`;
  return useAsyncResource(key, () => (ref ? getInvite(ref) : Promise.resolve(null)));
}
