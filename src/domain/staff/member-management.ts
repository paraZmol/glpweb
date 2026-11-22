import type { Member, MemberRole } from '../tenancy/types';
import type { MemberChangeRefusal } from './errors';

/** What an owner may change of another member: its role and whether it is active. */
export interface MemberChange {
  role?: MemberRole;
  active?: boolean;
}

export interface MemberChangeRequest {
  /** The owner making the change. */
  actorUid: string;
  /** The account that founded the distributor (`control.ownerUid`). */
  founderUid: string;
  target: Pick<Member, 'uid' | 'role'>;
  change: MemberChange;
}

/**
 * Why the change cannot be made, or null when it can (PLAN 3.2). The rules hold the same
 * conditions (`managesMember` in firebase/firestore.rules):
 * - nobody changes its own role or switches itself off;
 * - the founder stays an active owner, so the distributor always keeps one;
 * - only the founder makes someone an owner, demotes an owner or switches one off. Any owner
 *   manages the dispatchers and the drivers.
 * Staff is never removed, only switched off: what a member did keeps its author.
 */
export function memberChangeRefusal(request: MemberChangeRequest): MemberChangeRefusal | null {
  const { actorUid, founderUid, target, change } = request;
  if (target.uid === actorUid) return 'self';
  if (target.uid === founderUid) return 'founder';
  const touchesAnOwner = target.role === 'owner' || change.role === 'owner';
  return touchesAnOwner && actorUid !== founderUid ? 'ownersByFounderOnly' : null;
}

/** Only the fields whose value really changes; empty when nothing does. */
export function memberChangeOf(current: Pick<Member, 'role' | 'active'>, change: MemberChange) {
  const changed: MemberChange = {};
  if (change.role !== undefined && change.role !== current.role) changed.role = change.role;
  if (change.active !== undefined && change.active !== current.active) {
    changed.active = change.active;
  }
  return changed;
}

/**
 * Whether `changed` (from `memberChangeOf`) leaves an active owner as anything else: switched
 * off or with another role. An invitation works only while the owner who created it is an
 * active owner (`stillVouchedFor` in firebase/firestore.rules), so the change revokes that
 * person's invitations that wait, in the same transaction (PLAN §11, 2026-10-16): they would not
 * work any more, and switching the person back on must not bring them back.
 */
export function stopsBeingActiveOwner(
  current: Pick<Member, 'role' | 'active'>,
  changed: MemberChange,
): boolean {
  if (current.role !== 'owner' || !current.active) return false;
  return (changed.role ?? current.role) !== 'owner' || !(changed.active ?? current.active);
}

/** Whether a change asked for could leave an owner as anything else (worth looking first). */
export function mayStopAnOwner(change: MemberChange): boolean {
  return change.active === false || (change.role !== undefined && change.role !== 'owner');
}

/** The roles a screen may offer `actor` for another member: an owner only to the founder. */
export function assignableRoles(isFounder: boolean): MemberRole[] {
  return isFounder ? ['owner', 'dispatcher', 'driver'] : ['dispatcher', 'driver'];
}

const ROLE_ORDER: Record<MemberRole, number> = { owner: 0, dispatcher: 1, driver: 2 };

/** The staff list as the owner reads it: active first, then by role (owners first), then name. */
export function sortMembers<T extends Pick<Member, 'uid' | 'role' | 'active' | 'displayName'>>(
  members: readonly T[],
): T[] {
  return [...members].sort(
    (a, b) =>
      Number(b.active) - Number(a.active) ||
      ROLE_ORDER[a.role] - ROLE_ORDER[b.role] ||
      a.displayName.localeCompare(b.displayName, 'es') ||
      a.uid.localeCompare(b.uid),
  );
}
