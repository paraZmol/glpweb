import { DomainError } from '../tenancy/errors';
import type { StockLevels } from './plant-stock';

/** The change would leave fewer than zero full or empty cylinders at the plant. */
export class NegativeStockError extends DomainError {
  constructor(readonly after: StockLevels) {
    super(`Stock cannot go below zero (full ${after.full}, empty ${after.empty})`);
  }
}

/** The change would leave more cylinders than the sanity cap. */
export class StockCapError extends DomainError {
  constructor(readonly cap: number) {
    super(`Stock cannot go above ${cap} of each kind`);
  }
}

/** The adjustment names a product that is not in the catalogue of that distributor. */
export class StockProductNotFoundError extends DomainError {
  constructor(readonly productId: string) {
    super(`Product "${productId}" does not exist`);
  }
}

/** What the stock of one product holds, and the movement that left it like that. */
export interface StockSnapshot extends StockLevels {
  /** Null for a product never moved. */
  lastMovementId: string | null;
}

/**
 * A physical count was typed against a stock that changed meanwhile (another adjustment came
 * first): nothing is written, and `now` is what the stock holds at this moment, so the person
 * can count again.
 */
export class StockChangedError extends DomainError {
  constructor(readonly now: StockSnapshot) {
    super(`The stock changed meanwhile (full ${now.full}, empty ${now.empty})`);
  }
}
