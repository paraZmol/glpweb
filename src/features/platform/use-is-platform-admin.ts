import { isPlatformAdmin } from '../../data/platform-repo';
import { type ReloadableResource, useAsyncResource } from '../../lib/use-async-resource';
import { useSignedInSession } from '../auth/use-session';

/**
 * Whether the signed-in account is a platform admin, to decide which navigation to show
 * (PLAN 2.4). It grants nothing: every admin action is checked again by the security rules.
 * `idle` when signed out. One read per sign-in.
 */
export function useIsPlatformAdmin(): ReloadableResource<boolean> {
  const uid = useSignedInSession()?.uid ?? null;
  return useAsyncResource(uid, () => isPlatformAdmin(uid ?? ''));
}
