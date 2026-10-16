import { DomainError } from '../tenancy/errors';

/** Every vehicle slot of the distributor is in use (switched-off vehicles keep theirs). */
export class VehicleLimitError extends DomainError {
  constructor(readonly limit: number) {
    super(`A distributor can keep at most ${limit} vehicles`);
  }
}

/** The vehicle is not in that distributor. */
export class VehicleNotFoundError extends DomainError {
  constructor() {
    super('No such vehicle');
  }
}
