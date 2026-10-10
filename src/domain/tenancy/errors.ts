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

/** Every address slot of the account is in use. */
export class AddressLimitError extends DomainError {
  constructor(readonly limit: number) {
    super(`An account can keep at most ${limit} addresses`);
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
