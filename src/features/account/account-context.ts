import { createContext, useContext } from 'react';
import type { Session, SessionState } from '../../domain/auth/session';
import type { Member, MemberRole, UserProfile } from '../../domain/tenancy/types';
import type { ReloadableResource } from '../../lib/use-async-resource';
import type { AccountProfile } from '../auth/use-user-profile';
import type { CurrentDistributor } from '../tenancy/use-current-distributor';

/**
 * Everything the app knows about the signed-in account, read once by `AccountProvider` and
 * shared with the guards, the navigation and the pages of every area (PLAN 2.4). Each of the
 * four pieces keeps its own loading and error state.
 */
export interface AccountGateValue {
  session: SessionState;
  profile: ReloadableResource<AccountProfile>;
  current: CurrentDistributor;
  platformAdmin: ReloadableResource<boolean>;
}

export const AccountGateContext = createContext<AccountGateValue | null>(null);

export function useAccountGate(): AccountGateValue {
  const value = useContext(AccountGateContext);
  if (value === null) throw new Error('useAccountGate must be used inside AccountProvider');
  return value;
}

/**
 * The membership the panels work with, known from the moment the memberships load: also while
 * the distributor itself is still on its way (first load, or right after switching).
 */
export function membershipOf(current: CurrentDistributor): Member | null {
  if (current.status === 'ready') return current.membership;
  return current.status === 'loading' ? (current.membership ?? null) : null;
}

/** The account as a page behind a guard sees it: the session is known to exist. */
export interface Account {
  session: Session;
  /** Null only on the terms step, before the profile exists. */
  profile: UserProfile | null;
  reloadProfile: () => void;
  current: CurrentDistributor;
  /** Role in the distributor the panels show; null for an account that is only a customer. */
  role: MemberRole | null;
  /** Decides what to show only: the security rules check every admin action again. */
  isPlatformAdmin: boolean;
}

/** Only for screens rendered behind `RequireAccess`: it throws when nobody is signed in. */
export function useAccount(): Account {
  const { session, profile, current, platformAdmin } = useAccountGate();
  if (session.status !== 'signedIn') throw new Error('useAccount needs a signed-in session');
  return {
    session: session.session,
    profile: profile.status === 'ready' ? profile.data.profile : null,
    reloadProfile: profile.reload,
    current,
    role: membershipOf(current)?.role ?? null,
    isPlatformAdmin: platformAdmin.status === 'ready' && platformAdmin.data,
  };
}
