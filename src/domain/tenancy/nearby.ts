import { type GeoPoint, isWithinCoverage, sortByDistance } from '../geo/distance';
import type { PublicDistributor } from './types';

export interface NearbyDistributor {
  distributor: PublicDistributor;
  distanceKm: number;
}

/**
 * Distributors that can take an order at `point`: marked as accepting orders and with the point
 * inside their coverage circle. Nearest first.
 * PLAN 2.6: in the pilot this runs in the browser over the bounded list of listed distributors.
 * `acceptingOrders` is the public flag, which can lag behind an expired trial (PLAN 2.9): the
 * security rules still refuse the order, reading the control document.
 */
export function findNearbyDistributors(
  distributors: readonly PublicDistributor[],
  point: GeoPoint,
): NearbyDistributor[] {
  const serving = distributors.filter(
    (distributor) =>
      distributor.acceptingOrders &&
      isWithinCoverage(distributor.plant, point, distributor.coverageRadiusKm),
  );
  return sortByDistance(serving, point, (distributor) => distributor.plant).map(
    ({ item, distanceKm }) => ({ distributor: item, distanceKm }),
  );
}
