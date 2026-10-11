import type { FieldIssue } from './field-checks';

/** Base of the errors a screen is expected to translate into a message. */
export class DomainError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
  }
}

/** Another distributor already owns that link. */
export class SlugTakenError extends DomainError {
  constructor(readonly slug: string) {
    super(`Slug "${slug}" is already taken`);
  }
}

/** The form did not pass domain validation; `issues` says which fields and why. */
export class InvalidInputError extends DomainError {
  constructor(readonly issues: FieldIssue[]) {
    super(`Invalid input: ${issues.map((issue) => `${issue.field} ${issue.code}`).join(', ')}`);
  }
}

/** The account already founded the maximum number of distributors. */
export class DistributorLimitError extends DomainError {
  constructor(readonly limit: number) {
    super(`An account can found at most ${limit} distributors`);
  }
}

/**
 * The account owns a distributor that is read-only (suspended, past due or with its trial
 * over): it cannot found another one until that is settled (PLAN 2.11).
 */
export class FoundingBlockedError extends DomainError {
  constructor() {
    super('The account owns a distributor that is read-only and cannot found another one');
  }
}

/** The action needs a verified e-mail address. */
export class EmailNotVerifiedError extends DomainError {
  constructor() {
    super('The e-mail address is not verified');
  }
}

/** The action needs the account profile (`/users/{uid}`) to exist first. */
export class ProfileRequiredError extends DomainError {
  constructor() {
    super('The account has no profile yet');
  }
}

/**
 * The account already has a profile, so it cannot simply be discarded: its data has to be
 * removed with it, which the app cannot do by itself (privacy policy §7).
 */
export class AccountInUseError extends DomainError {
  constructor() {
    super('The account already has a profile and cannot be discarded from the app');
  }
}

/** Every address slot of the account is in use. */
export class AddressLimitError extends DomainError {
  constructor(readonly limit: number) {
    super(`An account can keep at most ${limit} addresses`);
  }
}

/**
 * The listing changed after the platform admin opened its review: the approval was for a version
 * that is no longer the stored one, so nothing was approved (PLAN 2.11).
 */
export class StaleReviewError extends DomainError {
  constructor(options?: ErrorOptions) {
    super('The listing changed while it was being reviewed', options);
  }
}

/** The security rules refused the operation (wrong role, suspended distributor, expired trial). */
export class PermissionDeniedError extends DomainError {
  constructor(options?: ErrorOptions) {
    super('The operation is not allowed', options);
  }
}

/** The operation needs a connection (transactions cannot be queued offline). */
export class OfflineError extends DomainError {
  constructor(options?: ErrorOptions) {
    super('The operation needs a connection', options);
  }
}

/** A stored document does not have the shape the app expects. */
export class CorruptDocumentError extends DomainError {
  constructor(path: string, detail: string) {
    super(`Document ${path} is malformed: ${detail}`);
  }
}
