import { type MemberRole, OFFICE_ROLES } from '../tenancy/types';
import type { SessionState } from './session';

/**
 * Which part of the app an account may open (PLAN 2.4). This only decides what to SHOW: every
 * read and write is checked again by the security rules, which read the role themselves.
 */
export const APP_AREAS = ['customer', 'driver', 'office', 'platform'] as const;
export type AppArea = (typeof APP_AREAS)[number];

/** What a route asks for: an area, one of the two pending steps, or "take me to my area". */
export type AccessGate = AppArea | 'acceptTerms' | 'verifyEmail' | 'home';

export type Loadable<T> =
  { status: 'loading' } | { status: 'error' } | { status: 'ready'; value: T };

export interface AccessInput {
  gate: AccessGate;
  session: SessionState;
  /** True when the account has no profile or accepted an older version of the terms. */
  termsPending: Loadable<boolean>;
  /** Role in the distributor the panels show; null for an account that is only a customer. */
  role: Loadable<MemberRole | null>;
  isPlatformAdmin: Loadable<boolean>;
}

export type AccessDecision =
  | { kind: 'wait' }
  | { kind: 'allow' }
  | { kind: 'error'; source: 'profile' | 'membership' | 'platform' }
  | { kind: 'redirect'; to: 'signIn' | 'acceptTerms' | 'verifyEmail' }
  /** `denied` is true when the account asked for an area it has no role for. */
  | { kind: 'redirect'; to: 'area'; area: AppArea; denied: boolean };

const WAIT: AccessDecision = { kind: 'wait' };
const ALLOW: AccessDecision = { kind: 'allow' };

export function areaForRole(role: MemberRole | null): AppArea {
  if (role === null) return 'customer';
  return role === 'driver' ? 'driver' : 'office';
}

function isOfficeRole(role: MemberRole | null): boolean {
  return role !== null && (OFFICE_ROLES as readonly MemberRole[]).includes(role);
}

/** The area an account lands on: its job first, then the platform panel, then ordering gas. */
function homeAreaOf(input: AccessInput): AppArea | 'wait' {
  if (input.role.status === 'loading') return 'wait';
  const role = input.role.status === 'ready' ? input.role.value : null;
  if (role !== null) return areaForRole(role);
  if (input.isPlatformAdmin.status === 'loading') return 'wait';
  const isAdmin = input.isPlatformAdmin.status === 'ready' && input.isPlatformAdmin.value;
  return isAdmin ? 'platform' : 'customer';
}

function sendHome(input: AccessInput, denied: boolean): AccessDecision {
  const area = homeAreaOf(input);
  return area === 'wait' ? WAIT : { kind: 'redirect', to: 'area', area, denied };
}

function decideArea(input: AccessInput): AccessDecision {
  const { gate, role, isPlatformAdmin } = input;
  if (gate === 'customer') return ALLOW;
  if (gate === 'platform') {
    if (isPlatformAdmin.status === 'loading') return WAIT;
    if (isPlatformAdmin.status === 'error') return { kind: 'error', source: 'platform' };
    return isPlatformAdmin.value ? ALLOW : sendHome(input, true);
  }
  if (role.status === 'loading') return WAIT;
  if (role.status === 'error') return { kind: 'error', source: 'membership' };
  if (gate === 'home') return sendHome(input, false);
  const fits = gate === 'driver' ? role.value === 'driver' : isOfficeRole(role.value);
  return fits ? ALLOW : sendHome(input, true);
}

/**
 * The steps go in order and nobody skips one: session → terms accepted → e-mail verified →
 * role for the area. The two pending-step screens are only reachable while their step is pending.
 */
export function decideAccess(input: AccessInput): AccessDecision {
  const { gate, session, termsPending } = input;
  if (session.status === 'loading') return WAIT;
  if (session.status === 'signedOut') return { kind: 'redirect', to: 'signIn' };
  if (termsPending.status === 'loading') return WAIT;
  if (termsPending.status === 'error') return { kind: 'error', source: 'profile' };

  if (gate === 'acceptTerms') return termsPending.value ? ALLOW : sendHome(input, false);
  if (termsPending.value) return { kind: 'redirect', to: 'acceptTerms' };

  const isVerified = session.session.emailVerified;
  if (gate === 'verifyEmail') return isVerified ? sendHome(input, false) : ALLOW;
  if (!isVerified) return { kind: 'redirect', to: 'verifyEmail' };

  return decideArea(input);
}
