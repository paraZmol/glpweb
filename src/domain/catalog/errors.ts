import { DomainError } from '../tenancy/errors';

/** Every product slot of the distributor is in use (deactivated products keep theirs). */
export class CatalogFullError extends DomainError {
  constructor(readonly limit: number) {
    super(`A distributor can keep at most ${limit} products`);
  }
}

/** The product is not in the catalogue of that distributor. */
export class ProductNotFoundError extends DomainError {
  constructor(readonly productId: string) {
    super(`Product "${productId}" does not exist`);
  }
}

/**
 * The order asked for does not name exactly the products of the catalogue: it changed in
 * another tab or device meanwhile. Nothing was written; reload the list and try again.
 */
export class StaleCatalogError extends DomainError {
  constructor() {
    super('The catalogue changed while it was being reordered');
  }
}

/**
 * A promotion covers the product until `until` (PLAN 3.5): its list prices cannot go up nor its
 * full cylinder be withdrawn before then. Nothing was written.
 */
export class PriceLockedError extends DomainError {
  constructor(readonly until: Date) {
    super(`The prices of the product are locked by a promotion until ${until.toISOString()}`);
  }
}
