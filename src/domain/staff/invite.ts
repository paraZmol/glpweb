import type { MemberRole } from '../tenancy/types';
import { INVITE_CODE_LENGTH, INVITE_TTL_DAYS } from './constants';

/**
 * An invitation to join the staff of a distributor (PLAN 3.2), at
 * `/distributors/{d}/invites/{code}`. There is no server to send an e-mail, so the owner shares
 * a link (WhatsApp, in person). The code — the document id — is the secret: whoever has the
 * link can read the invitation and use it once; nobody can list or guess the invitations of a
 * distributor except its owners.
 */
export const INVITE_STATUSES = ['pending', 'accepted', 'revoked'] as const;
export type InviteStatus = (typeof INVITE_STATUSES)[number];

/** What a screen says about an invitation: a pending one past its days is `expired`. */
export type InviteState = 'usable' | 'expired' | 'accepted' | 'revoked';

export interface Invite {
  /** The code: the document id and the secret of the link. */
  id: string;
  distributorId: string;
  role: MemberRole;
  /**
   * The Google address the invitation is tied to (lowercase), or null when any Google account
   * that has the link may use it. Required to invite an owner.
   */
  email: string | null;
  /** The public name of the distributor when the invitation was created (the rules check it). */
  distributorName: string;
  /**
   * The name of the owner who invited, as its member carried it when the invitation was created
   * (the rules check it), so whoever receives the link sees who invites without reading the
   * staff. Null in invitations older than the field (PLAN §11, 2026-10-15).
   */
  invitedByName: string | null;
  /**
   * The brand colour of the distributor when the invitation was created (the rules check it),
   * for the screen that joins. Not rewritten when the colour changes later. Null in older
   * invitations.
   */
  brandColor: string | null;
  status: InviteStatus;
  /** Uid of the owner who created it. */
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  /** Who used it and when; null until then. */
  acceptedBy: string | null;
  acceptedAt: Date | null;
  /** Who withdrew it and when; null unless it was revoked. */
  revokedBy: string | null;
  revokedAt: Date | null;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** The moment the invitation stops working: `INVITE_TTL_DAYS` after it was created. */
export function inviteExpiresAt(invite: Pick<Invite, 'createdAt'>): Date {
  return new Date(invite.createdAt.getTime() + INVITE_TTL_DAYS * MS_PER_DAY);
}

/** Same condition as the rules (`createdAt + 7 days > request.time`). */
export function isInviteExpired(invite: Pick<Invite, 'createdAt'>, now: Date): boolean {
  return inviteExpiresAt(invite).getTime() <= now.getTime();
}

export function inviteStateOf(
  invite: Pick<Invite, 'status' | 'createdAt'>,
  now: Date,
): InviteState {
  if (invite.status === 'accepted') return 'accepted';
  if (invite.status === 'revoked') return 'revoked';
  return isInviteExpired(invite, now) ? 'expired' : 'usable';
}

const CODE_PATTERN = new RegExp(`^[A-Za-z0-9]{${INVITE_CODE_LENGTH}}$`);

/** The shape of a code the rules accept (`isInviteCode`). Nothing else is ever read or written. */
export function isInviteCode(value: string): boolean {
  return CODE_PATTERN.test(value);
}

/** Where an invitation lives: enough to read it and to use it. */
export interface InviteRef {
  distributorId: string;
  code: string;
}

const DISTRIBUTOR_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const DISTRIBUTOR_KEY = 'd';
const CODE_KEY = 'c';

/**
 * The link the owner shares: `base` is the full address of the screen that joins (origin and
 * path), and the two ids travel in the fragment (`#d=…&c=…`). A browser never sends a fragment
 * to a server — not to Hosting, not in a `Referer`, not to the preview a chat app fetches. The
 * link itself travels through the channel the owner chooses to send it by (a chat, a message):
 * whoever runs that channel can read it, like any message sent there (PLAN §11, 2026-10-16).
 */
export function inviteLinkOf(base: string, ref: InviteRef): string {
  const fragment = new URLSearchParams({
    [DISTRIBUTOR_KEY]: ref.distributorId,
    [CODE_KEY]: ref.code,
  });
  return `${base}#${fragment.toString()}`;
}

/**
 * Reads the fragment of an invitation link (`location.hash`, with or without the `#`). Null when
 * it is not one: a code of another shape is never looked up.
 */
export function parseInviteFragment(hash: string): InviteRef | null {
  const params = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
  const distributorId = params.get(DISTRIBUTOR_KEY) ?? '';
  const code = params.get(CODE_KEY) ?? '';
  if (!DISTRIBUTOR_ID_PATTERN.test(distributorId) || !isInviteCode(code)) return null;
  return { distributorId, code };
}
