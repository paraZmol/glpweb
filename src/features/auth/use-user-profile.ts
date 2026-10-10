import { getUserProfile } from '../../data/users-repo';
import { needsTermsAcceptance } from '../../domain/legal/versions';
import type { UserProfile } from '../../domain/tenancy/types';
import { type ReloadableResource, useAsyncResource } from '../../lib/use-async-resource';
import { useSignedInSession } from './use-session';

export interface AccountProfile {
  /**
   * Null when the account has no profile yet: a first Google sign-in, or a registration that
   * lost the connection before its profile was stored. It is never created behind the scenes,
   * because a profile carries the acceptance of the terms.
   */
  profile: UserProfile | null;
  /**
   * True when the person must accept the current terms or privacy policy before going on (no
   * profile, one of the two missing, or an older version of either). Show the acceptance step
   * and call `acceptLegalDocuments(uid)`.
   */
  needsTermsAcceptance: boolean;
}

/**
 * The profile of the signed-in account and whether the terms are pending (PLAN 2.1, 2.7).
 * `idle` when signed out. One read per sign-in; call `reload()` after `saveProfile` or
 * `acceptLegalDocuments`.
 */
export function useUserProfile(): ReloadableResource<AccountProfile> {
  const uid = useSignedInSession()?.uid ?? null;
  return useAsyncResource(uid, async () => {
    const profile = await getUserProfile(uid ?? '');
    return { profile, needsTermsAcceptance: needsTermsAcceptance(profile) };
  });
}
