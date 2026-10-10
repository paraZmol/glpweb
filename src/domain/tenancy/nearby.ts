import { type GeoPoint, isWithinCoverage, sortByDistance } from '../geo/distance';
import { isWritable } from './status';
import type { Distributor } from './types';

export interface NearbyDistributor {
  distributor: Distributor;
  distanceKm: number;
}

/**
 * Distributors that can take an order at `point` right now: accepting writes (active, or trial
 * not over) and with the point inside their coverage circle. Nearest first.
 * PLAN 2.6: in the pilot this runs in the browser over the bounded list of visible distributors.
 */
export function findNearbyDistributors(
  distributors: readonly Distributor[],
  point: GeoPoint,
  now: Date,
): NearbyDistributor[] {
  const serving = distributors.filter(
    (distributor) =>
      isWritable(distributor, now) &&
      isWithinCoverage(distributor.plant, point, distributor.coverageRadiusKm),
  );
  return sortByDistance(serving, point, (distributor) => distributor.plant).map(
    ({ item, distanceKm }) => ({ distributor: item, distanceKm }),
  );
}
