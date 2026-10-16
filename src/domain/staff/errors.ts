import { DomainError } from '../tenancy/errors';

/** No invitation has that code in that distributor (a typo in the link, or never created). */
export class InviteNotFoundError extends DomainError {
  constructor() {
    super('No invitation has that code');
  }
}

/** The invitation was created more than `INVITE_TTL_DAYS` ago. Ask for a new one. */
export class InviteExpiredError extends DomainError {
  constructor() {
    super('The invitation expired');
  }
}

/** Somebody already used the invitation: it works once. */
export class InviteUsedError extends DomainError {
  constructor() {
    super('The invitation was already used');
  }
}

/** An owner withdrew the invitation. */
export class InviteRevokedError extends DomainError {
  constructor() {
    super('The invitation was withdrawn');
  }
}

/** The invitation is tied to another Google account than the one signed in. */
export class InviteForAnotherAccountError extends DomainError {
  constructor() {
    super('The invitation is for another account');
  }
}

/**
 * The account already belongs to that distributor (active or deactivated): an invitation adds
 * nobody twice. A deactivated member is reactivated by an owner instead.
 */
export class AlreadyMemberError extends DomainError {
  constructor(readonly isActive: boolean) {
    super('The account already belongs to that distributor');
  }
}

/** Why an owner cannot make that change to a member (the rules refuse it the same way). */
export type MemberChangeRefusal =
  /** Nobody changes its own role or switches itself off. */
  | 'self'
  /** The founder always stays an active owner: the distributor is never left without one. */
  | 'founder'
  /** Only the founder makes, unmakes or switches off another owner. */
  | 'ownersByFounderOnly';

export class MemberChangeNotAllowedError extends DomainError {
  constructor(readonly reason: MemberChangeRefusal) {
    super(`The member cannot be changed: ${reason}`);
  }
}

/** The member is not in the staff of that distributor. */
export class MemberNotFoundError extends DomainError {
  constructor() {
    super('No such member');
  }
}

/** Every helper slot of the distributor is in use (deactivated helpers keep theirs). */
export class HelperLimitError extends DomainError {
  constructor(readonly limit: number) {
    super(`A distributor can keep at most ${limit} helpers`);
  }
}

/** The helper is not in that distributor. */
export class HelperNotFoundError extends DomainError {
  constructor() {
    super('No such helper');
  }
}

/**
 * The name of the account's profile cannot be read (nothing but invisible characters, or one
 * that flips the writing): the staff would see it in its list (PLAN 3.2). Change it in the
 * account first.
 */
export class UnreadableNameError extends DomainError {
  constructor() {
    super('The name of the profile is not visible text');
  }
}
