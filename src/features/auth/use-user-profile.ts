import type { UserProfile } from '../../domain/tenancy/types';
import { type ReloadableResource, useAsyncResource } from '../../lib/use-async-resource';
import { ensureProfile } from './auth-actions';
import { useSignedInSession } from './use-session';

/**
 * The profile of the signed-in account, created on first use when missing (an account that
 * registered but lost the connection before its profile was stored). `idle` when signed out.
 * One read per sign-in; call `reload()` after `saveProfile`.
 */
export function useUserProfile(): ReloadableResource<UserProfile> {
  const session = useSignedInSession();
  return useAsyncResource(session?.uid ?? null, () => {
    if (!session) throw new Error('useUserProfile loaded without a session');
    return ensureProfile(session);
  });
}
