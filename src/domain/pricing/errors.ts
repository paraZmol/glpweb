import type { SaleMode } from '../catalog/sale-mode';
import { DomainError } from '../tenancy/errors';

/** All 20 promotion slots hold a promotion that is alive or saved without publishing. */
export class PromotionsFullError extends DomainError {
  constructor(readonly limit: number) {
    super(`A distributor can keep at most ${limit} promotions alive at once`);
  }
}

/** The promotion is not among those of the distributor. */
export class PromotionNotFoundError extends DomainError {
  constructor(readonly promotionId: string) {
    super(`Promotion "${promotionId}" does not exist`);
  }
}

/** Why a saved promotion cannot take a change (PLAN §11, 2026-10-16). */
export type PromotionRefusal =
  /** Switched off: final ("Repetir" makes another one). */
  | 'switchedOff'
  /** Past its end. */
  | 'ended'
  /** Publishing one that is already published. */
  | 'alreadyPublished'
  /** Switching off one that was never published. */
  | 'notPublished';

export class PromotionNotEditableError extends DomainError {
  constructor(readonly reason: PromotionRefusal) {
    super(`The promotion cannot change: ${reason}`);
  }
}

/** The slot was taken by another tab meanwhile: nothing was written. */
export class StalePromotionError extends DomainError {
  constructor() {
    super('The promotions changed while this one was being saved');
  }
}

/** An order names a product that is not on sale, or a way of selling it does not offer. */
export class UnpricedItemError extends DomainError {
  constructor(
    readonly productId: string,
    readonly saleMode: SaleMode,
  ) {
    super(`Product "${productId}" is not on sale as ${saleMode}`);
  }
}

/** An order line asks for no units, a fraction or a negative amount. */
export class InvalidQuantityError extends DomainError {
  constructor(readonly quantity: number) {
    super(`A line needs a whole number of units above zero, got ${quantity}`);
  }
}
