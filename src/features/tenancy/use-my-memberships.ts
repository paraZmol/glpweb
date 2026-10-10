import { listMyMemberships } from '../../data/distributors-repo';
import { sortMemberships } from '../../domain/tenancy/membership';
import type { Member } from '../../domain/tenancy/types';
import { type ReloadableResource, useAsyncResource } from '../../lib/use-async-resource';
import { useSignedInSession } from '../auth/use-session';

/**
 * Every distributor the signed-in account belongs to, with its role there (owner first).
 * Includes deactivated memberships (`active: false`) so a screen can explain them. `idle` when
 * signed out; an empty list means "customer only". One read per membership, no listener: call
 * `reload()` after founding a distributor or accepting an invitation.
 */
export function useMyMemberships(): ReloadableResource<Member[]> {
  const uid = useSignedInSession()?.uid ?? null;
  return useAsyncResource(uid, async () => sortMemberships(await listMyMemberships(uid ?? '')));
}
