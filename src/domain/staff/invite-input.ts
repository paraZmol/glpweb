import { type Check, checkText, collectIssues, type Validated } from '../tenancy/field-checks';
import { MEMBER_ROLES, type MemberRole } from '../tenancy/types';
import { INVITE_EMAIL_MAX_LENGTH } from './constants';
import {
  AlreadyMemberError,
  InviteExpiredError,
  InviteForAnotherAccountError,
  InviteRevokedError,
  InviteUsedError,
} from './errors';
import { type Invite, inviteStateOf } from './invite';

/** What the owner fills in to invite someone. */
export interface InviteInput {
  role: MemberRole;
  /**
   * The Google address of the person, to tie the invitation to that account only. Optional for
   * the dispatcher and the driver; required to invite an owner.
   */
  email?: string;
}

/** A validated invitation, ready to be written. */
export interface NewInvite {
  role: MemberRole;
  /** Lowercase, or null when any Google account with the link may use it. */
  email: string | null;
}

/** Who is inviting: only the founder of the distributor invites another owner. */
export interface Inviter {
  isFounder: boolean;
}

/** Same pattern as `isInviteEmail` in firebase/firestore.rules: one @, no spaces, a dot after. */
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Google hands over addresses in lowercase; the rules compare with the token in lowercase. */
export function normalizeInviteEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

function checkEmail(email: string | null, role: MemberRole): Check {
  if (email === null) return role === 'owner' ? 'required' : null;
  const length = checkText(email, 1, INVITE_EMAIL_MAX_LENGTH);
  if (length) return length;
  return EMAIL_PATTERN.test(email) ? null : 'invalid';
}

function checkRole(role: MemberRole, inviter: Inviter): Check {
  if (!MEMBER_ROLES.includes(role)) return 'invalid';
  return role === 'owner' && !inviter.isFounder ? 'founderOnly' : null;
}

/**
 * Validates an invitation (PLAN 3.2). Any owner invites a dispatcher or a driver; only the
 * founder invites another owner, and that invitation must name the Google account it is for:
 * an owner can do almost everything the founder can, so a forwarded link must not be enough.
 * The rules hold the same conditions.
 */
export function prepareInvite(input: InviteInput, inviter: Inviter): Validated<NewInvite> {
  const typed = normalizeInviteEmail(input.email ?? '');
  const value: NewInvite = { role: input.role, email: typed === '' ? null : typed };
  const issues = collectIssues([
    ['role', checkRole(value.role, inviter)],
    ['email', checkEmail(value.email, value.role)],
  ]);
  return issues.length > 0 ? { ok: false, issues } : { ok: true, value };
}

/** The account that wants to use an invitation. */
export interface Joiner {
  uid: string;
  /** The e-mail of its Google session. */
  email: string;
}

/**
 * Why `joiner` cannot use `invite` right now, as the error to throw, or null when it can. Same
 * conditions as the rules, except the ones only they can see (a distributor that is read-only, a
 * missing profile): those come back as a refusal.
 */
export function inviteRefusalFor(invite: Invite, joiner: Joiner, now: Date): Error | null {
  const state = inviteStateOf(invite, now);
  if (state === 'accepted') {
    return invite.acceptedBy === joiner.uid ? new AlreadyMemberError(true) : new InviteUsedError();
  }
  if (state === 'revoked') return new InviteRevokedError();
  if (state === 'expired') return new InviteExpiredError();
  if (invite.email !== null && invite.email !== normalizeInviteEmail(joiner.email)) {
    return new InviteForAnotherAccountError();
  }
  return null;
}
