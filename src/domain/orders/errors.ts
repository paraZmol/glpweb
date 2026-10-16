import { DomainError } from '../tenancy/errors';
import type { CreationRefusal } from './creation';
import type { OrderRefusal } from './guards';
import type { RatingRefusal } from './rating';

/**
 * The promotions calculation returned lines that are not the ones asked for, or prices that do
 * not follow from the catalogue. A bug, never a message for the customer: nothing is written.
 */
export class PricingMismatchError extends DomainError {
  constructor(readonly detail: string) {
    super(`The priced lines break the order contract: ${detail}`);
  }
}

/** The order cannot be created; `reason` says why (the rules refuse it the same way). */
export class OrderNotCreatedError extends DomainError {
  constructor(readonly reason: CreationRefusal) {
    super(`The order cannot be created: ${reason}`);
  }
}

/** The order cannot move to that status, by that actor, with that data. */
export class OrderTransitionError extends DomainError {
  constructor(readonly reason: OrderRefusal) {
    super(`The order cannot change status: ${reason}`);
  }
}

/**
 * Another driver accepted the order first, or the office changed it meanwhile: the transaction
 * found another status than the one it started from (glp-domain §6.1).
 */
export class OrderAlreadyTakenError extends DomainError {
  constructor() {
    super('The order is no longer pending');
  }
}

export class OrderNotRatedError extends DomainError {
  constructor(readonly reason: RatingRefusal) {
    super(`The order cannot be rated: ${reason}`);
  }
}
