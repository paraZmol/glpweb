import { type GeoPoint, isValidGeoPoint } from '../../domain/geo/distance';
import { findNearbyDistributors, type NearbyDistributor } from '../../domain/tenancy/nearby';
import { type ReloadableResource, useAsyncResource } from '../../lib/use-async-resource';
import { forgetVisibleDistributors, loadVisibleDistributors } from './visible-distributors';

const COORDINATE_DECIMALS = 5; // about one metre: enough to tell two pins apart

/**
 * Distributors that deliver to `point` right now, nearest first, each with `distanceKm`
 * (PLAN 2.6). Pass null until the customer has a location: the result is `idle`. An empty list
 * means nobody covers that point.
 * Reads: one bounded query (at most 50 documents) shared by every search for five minutes;
 * moving the pin filters in the browser at no cost. `reload()` asks the server again.
 */
export function useNearbyDistributors(
  point: GeoPoint | null,
): ReloadableResource<NearbyDistributor[]> {
  const usable = point !== null && isValidGeoPoint(point) ? point : null;
  const key = usable
    ? `${usable.lat.toFixed(COORDINATE_DECIMALS)},${usable.lng.toFixed(COORDINATE_DECIMALS)}`
    : null;
  const resource = useAsyncResource(key, async () => {
    const now = new Date();
    const visible = await loadVisibleDistributors(now.getTime());
    return usable ? findNearbyDistributors(visible, usable, now) : [];
  });
  const reload = () => {
    forgetVisibleDistributors();
    resource.reload();
  };
  return { ...resource, reload };
}
