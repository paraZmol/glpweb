import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  type Transaction,
  where,
} from 'firebase/firestore';
import { INVITES_QUERY_LIMIT, INVITES_QUERY_MAX } from '../domain/staff/constants';
import {
  AlreadyMemberError,
  InviteNotFoundError,
  InviteRevokedError,
  InviteUsedError,
  MemberChangeNotAllowedError,
  MemberNotFoundError,
  UnreadableNameError,
} from '../domain/staff/errors';
import { type Invite, type InviteRef, isInviteCode } from '../domain/staff/invite';
import { inviteRefusalFor, type Joiner, type NewInvite } from '../domain/staff/invite-input';
import {
  type MemberChange,
  mayStopAnOwner,
  memberChangeOf,
  memberChangeRefusal,
  sortMembers,
  stopsBeingActiveOwner,
} from '../domain/staff/member-management';
import { MEMBERS_QUERY_LIMIT } from '../domain/tenancy/constants';
import {
  CorruptDocumentError,
  NothingChangedError,
  PermissionDeniedError,
  ProfileRequiredError,
} from '../domain/tenancy/errors';
import { isVisibleText } from '../domain/tenancy/field-checks';
import type { Member, MemberRole } from '../domain/tenancy/types';
import {
  controlConverter,
  inviteConverter,
  memberConverter,
  publicDistributorConverter,
  userProfileConverter,
} from './converters';
import { guarded, toDataError } from './errors';
import { db } from './firebase';
import { paths } from './paths';

const inviteRef = (d: string, code: string) => doc(db, paths.invite(d, code));
const memberRef = (d: string, uid: string) => doc(db, paths.member(d, uid));

// ------------------------------------------------------------------------------ invitations ----

export interface InviteRequest {
  distributorId: string;
  /** From `prepareInvite`. */
  invite: NewInvite;
  /** The owner who invites (the session's uid). */
  createdBy: string;
}

/**
 * Owner only, while the distributor is writable (PLAN 3.2): creates an invitation and returns
 * its code, the secret of the link (`inviteLinkOf`). The code is an automatic id: 20 letters and
 * digits from the browser's cryptographic random source, so nobody can guess it. The
 * invitation carries copies of the public name and of the brand colour of the distributor and of
 * the name of the owner who invites (its member), read in the same transaction: whoever
 * receives the link cannot read the distributor nor its staff yet (PLAN §11, 2026-10-15). The
 * name of the owner is left out when it is not visible text (a member stored before that check). Only the founder may invite an owner, and
 * only tied to an address (`prepareInvite` checks it; the rules too).
 * Throws `PermissionDeniedError` (not an owner, read-only distributor, an owner invitation from
 * a co-owner) or `OfflineError` (a transaction is not queued without a connection).
 * Cost: 2 reads + 1 write, plus 3 lookups by the rules (the member it copies is the one the
 * rules read for the role).
 */
export function createInvite({ distributorId: d, invite, createdBy }: InviteRequest) {
  const code = doc(collection(db, paths.invites(d))).id;
  return guarded(() =>
    runTransaction(db, async (tx) => {
      const profileRef = doc(db, paths.distributor(d)).withConverter(publicDistributorConverter);
      const profile = (await tx.get(profileRef)).data();
      if (!profile) throw new CorruptDocumentError(paths.distributor(d), 'it does not exist');
      const inviter = (await tx.get(memberRef(d, createdBy).withConverter(memberConverter))).data();
      const inviterName =
        inviter && isVisibleText(inviter.displayName) ? inviter.displayName : null;
      tx.set(inviteRef(d, code), {
        role: invite.role,
        email: invite.email,
        distributorName: profile.name,
        brandColor: profile.brandColor,
        ...(inviterName === null ? {} : { invitedByName: inviterName }),
        status: 'pending',
        createdBy,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return code;
    }),
  );
}

/**
 * Owner only: the invitations that wait, newest first, up to `INVITES_QUERY_LIMIT` (one past
 * its days still waits: `inviteStateOf` tells it apart). Not live.
 * Cost: one read per invitation (one when there is none), plus 1 by the rules.
 * Composite index: invites (status, createdAt desc).
 */
export function listPendingInvites(d: string): Promise<Invite[]> {
  return guarded(async () => {
    const waiting = query(
      collection(db, paths.invites(d)).withConverter(inviteConverter),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc'),
      limit(INVITES_QUERY_LIMIT),
    );
    return (await getDocs(waiting)).docs.map((invite) => invite.data());
  });
}

/**
 * The invitation of a link, for whoever holds it (any account signed in with Google). Null
 * when no invitation has that code there — also for a code of another shape, which is never
 * looked up — and when the rules refuse it: one tied to the address of another account is read
 * only by that account and by an owner, and the rules refuse a code nobody created alike (PLAN
 * §11, 2026-10-16). One read, none by the rules (1 for an owner reading one tied to another).
 */
export async function getInvite({ distributorId, code }: InviteRef): Promise<Invite | null> {
  if (!isInviteCode(code)) return null;
  try {
    return await guarded(async () => {
      const ref = inviteRef(distributorId, code).withConverter(inviteConverter);
      return (await getDoc(ref)).data() ?? null;
    });
  } catch (error) {
    if (error instanceof PermissionDeniedError) return null;
    throw error;
  }
}

/**
 * Owner only, also while the distributor is read-only (it only takes access away): withdraws an
 * invitation that waits. Throws `InviteNotFoundError`, `InviteUsedError` (somebody already
 * joined with it: switch that member off instead), `InviteRevokedError`,
 * `PermissionDeniedError` or `OfflineError`.
 * Cost: 1 read + 1 write, plus 2 lookups by the rules.
 */
export function revokeInvite(ref: InviteRef, ownerUid: string): Promise<void> {
  const target = inviteRef(ref.distributorId, ref.code);
  return guarded(() =>
    runTransaction(db, async (tx) => {
      const invite = (await tx.get(target.withConverter(inviteConverter))).data();
      if (!invite) throw new InviteNotFoundError();
      if (invite.status === 'accepted') throw new InviteUsedError();
      if (invite.status === 'revoked') throw new InviteRevokedError();
      tx.update(target, {
        status: 'revoked',
        revokedBy: ownerUid,
        revokedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }),
  );
}

export interface JoinRequest {
  ref: InviteRef;
  /** The session: its uid and the e-mail Google confirmed. */
  joiner: Joiner;
  /** Device time; the rules decide with server time. */
  now: Date;
}

/** What the account became by using an invitation. */
export interface Joined {
  distributorId: string;
  role: MemberRole;
}

/** Why `joiner` cannot use the invitation as it stands, or null when nothing says so. */
function joinRefusal(
  invite: Invite | undefined,
  member: Member | undefined,
  joiner: Joiner,
  now: Date,
): Error | null {
  if (!invite) return new InviteNotFoundError();
  if (member) return new AlreadyMemberError(member.active);
  return inviteRefusalFor(invite, joiner, now);
}

async function joinInTransaction(tx: Transaction, { ref, joiner, now }: JoinRequest) {
  const { distributorId: d, code } = ref;
  const invite = (await tx.get(inviteRef(d, code).withConverter(inviteConverter))).data();
  const member = (await tx.get(memberRef(d, joiner.uid).withConverter(memberConverter))).data();
  const userRef = doc(db, paths.user(joiner.uid)).withConverter(userProfileConverter);
  const profile = (await tx.get(userRef)).data();
  const refusal = joinRefusal(invite, member, joiner, now);
  if (refusal) throw refusal;
  if (!invite) throw new InviteNotFoundError();
  if (!profile) throw new ProfileRequiredError();
  // The staff reads this name in its list; the rules refuse one nobody can read (PLAN 3.2).
  if (!isVisibleText(profile.displayName)) throw new UnreadableNameError();
  tx.set(memberRef(d, joiner.uid), {
    uid: joiner.uid,
    distributorId: d,
    role: invite.role,
    active: true,
    displayName: profile.displayName,
    distributorName: invite.distributorName,
    inviteId: code,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  tx.update(inviteRef(d, code), {
    status: 'accepted',
    acceptedBy: joiner.uid,
    acceptedAt: serverTimestamp(),
    // The address has no purpose once used; the rules demand it cleared (PLAN §11, 2026-10-16).
    email: null,
    updatedAt: serverTimestamp(),
  });
  return { distributorId: d, role: invite.role };
}

/**
 * Why the rules refused a join: another request of the same moment got there first (the
 * invitation was used, or this account joined in another tab), or the invitation cannot be
 * read — tied to another address, or missing, which the rules refuse alike and this reports as
 * `InviteNotFoundError` (PLAN §11, 2026-10-16). Two reads. Null when the documents say nothing
 * new.
 */
async function explainJoinRefusal({ ref, joiner, now }: JoinRequest): Promise<Error | null> {
  const [invite, member] = await Promise.all([
    getInvite(ref),
    getDoc(memberRef(ref.distributorId, joiner.uid).withConverter(memberConverter)),
  ]);
  return joinRefusal(invite ?? undefined, member.data(), joiner, now);
}

/**
 * Uses an invitation (PLAN 3.2): in one transaction the account creates its own member, with
 * the role of the invitation and the name of its profile, and marks the invitation used by
 * itself. The rules accept the two only together, only while the invitation waits, within its
 * days, for this account when it names one, and while the distributor is writable: it works
 * once. Two accounts with the same link at the same time: one wins, the other gets
 * `InviteUsedError`.
 * Throws `InviteNotFoundError`, `InviteUsedError`, `InviteRevokedError`, `InviteExpiredError`,
 * `InviteForAnotherAccountError`, `AlreadyMemberError` (it already works there, active or not:
 * an owner switches it back on instead), `ProfileRequiredError` (the terms are not accepted
 * yet), `UnreadableNameError` (the name of the profile is not visible text: change it first), `PermissionDeniedError` (the distributor is read-only, its name changed under an
 * invitation nobody refreshed, or its days ran out by the server's clock) or `OfflineError`.
 * Cost: 3 reads + 2 writes, plus 6 lookups by the rules; 2 reads more after a refusal.
 */
export async function acceptInvite(request: JoinRequest): Promise<Joined> {
  if (!isInviteCode(request.ref.code)) throw new InviteNotFoundError();
  try {
    return await runTransaction(db, (tx) => joinInTransaction(tx, request));
  } catch (error) {
    const translated = toDataError(error);
    if (!(translated instanceof PermissionDeniedError)) throw translated;
    throw (await explainJoinRefusal(request).catch(() => null)) ?? translated;
  }
}

// ---------------------------------------------------------------------------------- members ----

/**
 * The staff of a distributor, active or not, sorted for the owner (`sortMembers`). Owner and
 * dispatcher only. Cost: one read per member (one when there is none), plus 1 by the rules.
 */
export function listStaff(d: string): Promise<Member[]> {
  return guarded(async () => {
    const staff = query(
      collection(db, paths.members(d)).withConverter(memberConverter),
      limit(MEMBERS_QUERY_LIMIT),
    );
    return sortMembers((await getDocs(staff)).docs.map((member) => member.data()));
  });
}

export interface StaffChange {
  distributorId: string;
  /** The owner who makes the change (the session's uid). */
  actorUid: string;
  /** The member it changes. */
  uid: string;
  change: MemberChange;
}

/**
 * The codes of the invitations `uid` created that still wait, up to the rules' cap
 * (`INVITES_QUERY_MAX`). Owner only. Cost: one read per invitation (one when there is none),
 * plus 1 by the rules. Equality filters only: no composite index.
 */
async function pendingInviteCodesBy(d: string, uid: string): Promise<string[]> {
  const waiting = query(
    collection(db, paths.invites(d)),
    where('createdBy', '==', uid),
    where('status', '==', 'pending'),
    limit(INVITES_QUERY_MAX),
  );
  return (await getDocs(waiting)).docs.map((invite) => invite.id);
}

/** Revokes, inside `tx`, the invitations of `codes` that still wait (read in the transaction). */
async function revokeWaitingInvites(tx: Transaction, d: string, codes: string[], by: string) {
  const refs = codes.map((code) => inviteRef(d, code));
  const invites = await Promise.all(refs.map((ref) => tx.get(ref.withConverter(inviteConverter))));
  refs.forEach((ref, index) => {
    if (invites[index]?.data()?.status !== 'pending') return;
    tx.update(ref, {
      status: 'revoked',
      revokedBy: by,
      revokedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
}

/**
 * Owner only, while the distributor is writable: changes the role of another member or switches
 * it off or back on (PLAN 3.2). Nobody changes itself, the founder is never changed, and only
 * the founder makes, unmakes or switches off another owner (`memberChangeRefusal`; the rules
 * hold the same). Staff is never deleted. Writes only what changes. When an owner is switched
 * off or demoted, the same transaction revokes the invitations it created that still wait, up
 * to `INVITES_QUERY_MAX` (PLAN §11, 2026-10-16): the rules already refuse them, and switching
 * the person back on does not bring them back.
 * Throws `MemberNotFoundError`, `MemberChangeNotAllowedError` (with its reason),
 * `NothingChangedError`, `PermissionDeniedError` (not an owner, read-only distributor) or
 * `OfflineError`.
 * Cost: 2 reads + 1 write, plus 2 lookups by the rules for the reads and 2 for the write. When
 * the change could leave an owner as something else, 1 query first (one read per waiting
 * invitation of that person, at least one) and, when it does, 1 read + 1 write per invitation.
 */
export function changeStaffMember({ distributorId: d, actorUid, uid, change }: StaffChange) {
  return guarded(async () => {
    const waiting = mayStopAnOwner(change) ? await pendingInviteCodesBy(d, uid) : [];
    return runTransaction(db, async (tx) => {
      const controlRef = doc(db, paths.distributorControl(d)).withConverter(controlConverter);
      const control = (await tx.get(controlRef)).data();
      const target = (await tx.get(memberRef(d, uid).withConverter(memberConverter))).data();
      if (!control || !target) throw new MemberNotFoundError();
      const founderUid = control.ownerUid;
      const reason = memberChangeRefusal({ actorUid, founderUid, target, change });
      if (reason) throw new MemberChangeNotAllowedError(reason);
      const changed = memberChangeOf(target, change);
      if (Object.keys(changed).length === 0) throw new NothingChangedError();
      if (stopsBeingActiveOwner(target, changed)) {
        await revokeWaitingInvites(tx, d, waiting, actorUid);
      }
      tx.update(memberRef(d, uid), { ...changed, updatedAt: serverTimestamp() });
    });
  });
}
