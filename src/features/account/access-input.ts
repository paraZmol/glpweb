import type { AccessGate, AccessInput, Loadable } from '../../domain/auth/access';
import type { MemberRole } from '../../domain/tenancy/types';
import type { AccountGateValue } from './account-context';

const LOADING = { status: 'loading' } as const;
const FAILED = { status: 'error' } as const;

function termsPendingOf({ profile }: AccountGateValue): Loadable<boolean> {
  if (profile.status === 'error') return FAILED;
  if (profile.status !== 'ready') return LOADING;
  return { status: 'ready', value: profile.data.needsTermsAcceptance };
}

function roleOf({ current }: AccountGateValue): Loadable<MemberRole | null> {
  if (current.status === 'error') return FAILED;
  if (current.status === 'none') return { status: 'ready', value: null };
  if (current.status !== 'ready') return LOADING;
  return { status: 'ready', value: current.membership.role };
}

function adminOf({ platformAdmin }: AccountGateValue): Loadable<boolean> {
  if (platformAdmin.status === 'error') return FAILED;
  if (platformAdmin.status !== 'ready') return LOADING;
  return { status: 'ready', value: platformAdmin.data };
}

/** Translates what the hooks report into the plain facts `decideAccess` reasons about. */
export function accessInputFor(gate: AccessGate, account: AccountGateValue): AccessInput {
  return {
    gate,
    session: account.session,
    termsPending: termsPendingOf(account),
    role: roleOf(account),
    isPlatformAdmin: adminOf(account),
  };
}
