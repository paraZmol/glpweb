import { type ReactNode, useState } from 'react';
import type { ReloadableResource } from '../../lib/use-async-resource';
import { useSession } from '../auth/use-session';
import { type AccountProfile, useUserProfile } from '../auth/use-user-profile';
import { useIsPlatformAdmin } from '../platform/use-is-platform-admin';
import { useCurrentDistributor } from '../tenancy/use-current-distributor';
import { AccountGateContext, type AccountGateValue } from './account-context';

/**
 * While the profile is read again (after saving it or accepting the terms) the last known one
 * stays on screen: the page must not fall back to a skeleton and lose what the person sees.
 */
function useProfileKeptWhileReloading(
  uid: string | null,
  profile: ReloadableResource<AccountProfile>,
): ReloadableResource<AccountProfile> {
  const [last, setLast] = useState<{ uid: string; data: AccountProfile } | null>(null);
  if (uid !== null && profile.status === 'ready' && last?.data !== profile.data) {
    setLast({ uid, data: profile.data });
  }
  const canReuse = profile.status === 'loading' && last !== null && last.uid === uid;
  return canReuse ? { status: 'ready', data: last.data, reload: profile.reload } : profile;
}

/**
 * Reads the session, the profile, the memberships and the admin flag ONCE for every screen
 * under it. Calling those hooks again in a page would repeat their Firestore reads.
 */
export function AccountProvider({ children }: { children: ReactNode }) {
  const session = useSession();
  const uid = session.status === 'signedIn' ? session.session.uid : null;
  const profile = useProfileKeptWhileReloading(uid, useUserProfile());
  const current = useCurrentDistributor();
  const platformAdmin = useIsPlatformAdmin();

  // The hooks hand back a new object whenever something changed, so the value needs no memo.
  const value: AccountGateValue = { session, profile, current, platformAdmin };
  return <AccountGateContext value={value}>{children}</AccountGateContext>;
}
