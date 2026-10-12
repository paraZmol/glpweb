import { type GeoPoint, isValidGeoPoint } from '../../domain/geo/distance';
import { findNearbyDistributors, type NearbyDistributor } from '../../domain/tenancy/nearby';
import { type ReloadableResource, useAsyncResource } from '../../lib/use-async-resource';
import { forgetVisibleDistributors, loadVisibleDistributors } from './visible-distributors';

const COORDINATE_DECIMALS = 5; // about one metre: enough to tell two pins apart

/**
 * Distributors that deliver to `point` and take orders, nearest first, each with `distanceKm`
 * (PLAN 2.6). Pass null until the customer has a location: the result is `idle`. An empty list
 * means nobody covers that point. Each entry is the public profile only; one of them may still
 * refuse an order if its trial ran out and nobody of its staff opened the panel since.
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
    const visible = await loadVisibleDistributors(Date.now());
    return usable ? findNearbyDistributors(visible, usable) : [];
  });
  const reload = () => {
    forgetVisibleDistributors();
    resource.reload();
  };
  return { ...resource, reload };
}
