import * as helpersRepo from '../../data/helpers-repo';
import * as staffRepo from '../../data/staff-repo';
import { prepareHelperName } from '../../domain/staff/helper';
import { type InviteRef, inviteLinkOf } from '../../domain/staff/invite';
import { type InviteInput, prepareInvite } from '../../domain/staff/invite-input';
import type { MemberChange } from '../../domain/staff/member-management';
import { EmailNotVerifiedError, InvalidInputError } from '../../domain/tenancy/errors';
import type { Distributor } from '../../domain/tenancy/types';

/** Who acts: the signed-in session, as `useSignedInSession()` gives it. */
export interface Actor {
  uid: string;
  email: string | null;
}

/** A new invitation, ready to be shared. */
export interface SharedInvite {
  ref: InviteRef;
  /** The link to send by WhatsApp: the code travels in the fragment (`#d=…&c=…`). */
  link: string;
}

/**
 * Owner only (PLAN 3.2): invites someone to the staff of `distributor` as `input.role`. Any
 * owner invites a dispatcher or a driver; only the founder invites another owner, and then the
 * Google address is required (an owner can do almost everything). `joinUrl` is the full address
 * of the screen that receives the link (origin and path, without `#`). There is no e-mail: the
 * screen shares `link` (WhatsApp, copy). It works once, for 7 days, until revoked.
 * Throws `InvalidInputError` (`role: founderOnly`, `email: required | invalid | tooLong`),
 * `PermissionDeniedError` (not an owner, read-only distributor) or `OfflineError`.
 */
export async function inviteStaff(
  distributor: Distributor,
  actor: Actor,
  input: InviteInput,
  joinUrl: string,
): Promise<SharedInvite> {
  const prepared = prepareInvite(input, { isFounder: distributor.ownerUid === actor.uid });
  if (!prepared.ok) throw new InvalidInputError(prepared.issues);
  const code = await staffRepo.createInvite({
    distributorId: distributor.id,
    invite: prepared.value,
    createdBy: actor.uid,
  });
  const ref = { distributorId: distributor.id, code };
  return { ref, link: inviteLinkOf(joinUrl, ref) };
}

/** The link of an invitation that waits, to share it again (`joinUrl` as in `inviteStaff`). */
export function linkOfInvite(ref: InviteRef, joinUrl: string): string {
  return inviteLinkOf(joinUrl, ref);
}

/**
 * Owner only: withdraws an invitation that waits; its link stops working at once. Throws
 * `InviteNotFoundError`, `InviteUsedError`, `InviteRevokedError`, `PermissionDeniedError` or
 * `OfflineError`.
 */
export function revokeStaffInvite(ref: InviteRef, actor: Actor): Promise<void> {
  return staffRepo.revokeInvite(ref, actor.uid);
}

/**
 * Uses the invitation of a link (`parseInviteFragment(location.hash)` gives `ref`): the account
 * joins the staff with the role of the invitation. Reload the memberships afterwards
 * (`useAccount().current.reload()`) to enter the new area. Throws the errors of
 * `staffRepo.acceptInvite` (`describeJoinError` puts them in words), or `EmailNotVerifiedError`
 * for a session without a confirmed e-mail (it should not exist).
 */
export function joinWithInvite(
  ref: InviteRef,
  actor: Actor,
  now = new Date(),
): Promise<staffRepo.Joined> {
  if (actor.email === null) return Promise.reject(new EmailNotVerifiedError());
  return staffRepo.acceptInvite({ ref, joiner: { uid: actor.uid, email: actor.email }, now });
}

/**
 * Owner only: changes the role of another member, or switches it off or back on. Nobody
 * changes itself, the founder never changes, and only the founder touches another owner.
 * Throws `MemberChangeNotAllowedError` (`reason`: `self`, `founder`, `ownersByFounderOnly`),
 * `MemberNotFoundError`, `NothingChangedError`, `PermissionDeniedError` or `OfflineError`.
 */
export function changeStaffMember(
  distributorId: string,
  actor: Actor,
  uid: string,
  change: MemberChange,
): Promise<void> {
  return staffRepo.changeStaffMember({ distributorId, actorUid: actor.uid, uid, change });
}

/**
 * Owner only: adds a helper (a person who goes with a truck and never signs in) with the name
 * as typed. Returns its id. Throws `InvalidInputError` (`name`), `HelperLimitError`,
 * `PermissionDeniedError` or `OfflineError`.
 */
export function addHelper(distributorId: string, rawName: string): Promise<string> {
  const prepared = prepareHelperName(rawName);
  if (!prepared.ok) return Promise.reject(new InvalidInputError(prepared.issues));
  return helpersRepo.addHelper(distributorId, prepared.value);
}

/** Owner only: renames a helper. Same errors as `addHelper`, plus `HelperNotFoundError`. */
export function renameHelper(
  distributorId: string,
  helperId: string,
  rawName: string,
): Promise<void> {
  const prepared = prepareHelperName(rawName);
  if (!prepared.ok) return Promise.reject(new InvalidInputError(prepared.issues));
  return helpersRepo.updateHelper(distributorId, helperId, { name: prepared.value });
}

/** Owner only: switches a helper off (it is no longer offered) or back on. */
export function setHelperActive(
  distributorId: string,
  helperId: string,
  isActive: boolean,
): Promise<void> {
  return helpersRepo.updateHelper(distributorId, helperId, { active: isActive });
}
