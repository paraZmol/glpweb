export interface GeoPoint {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_KM = 6371.0088;
const MAX_LATITUDE = 90;
const MAX_LONGITUDE = 180;
const DEGREES_PER_HALF_TURN = 180;

const toRadians = (degrees: number) => (degrees * Math.PI) / DEGREES_PER_HALF_TURN;

/** True for finite coordinates inside the globe. The security rules repeat the same ranges. */
export function isValidGeoPoint(point: GeoPoint): boolean {
  return (
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lng) &&
    Math.abs(point.lat) <= MAX_LATITUDE &&
    Math.abs(point.lng) <= MAX_LONGITUDE
  );
}

/** Great-circle distance between two points, in kilometres (Haversine). */
export function haversineKm(from: GeoPoint, to: GeoPoint): number {
  const latitudeDelta = toRadians(to.lat - from.lat);
  const longitudeDelta = toRadians(to.lng - from.lng);
  const halfChord =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(halfChord)));
}

/** Coverage is a circle around the plant: a point is served when it lies within the radius. */
export function isWithinCoverage(plant: GeoPoint, point: GeoPoint, radiusKm: number): boolean {
  if (!isValidGeoPoint(plant) || !isValidGeoPoint(point)) return false;
  if (!Number.isFinite(radiusKm) || radiusKm <= 0) return false;
  return haversineKm(plant, point) <= radiusKm;
}

export interface WithDistance<T> {
  item: T;
  distanceKm: number;
}

/** Returns the items with their distance to `origin`, nearest first. The input is not mutated. */
export function sortByDistance<T>(
  items: readonly T[],
  origin: GeoPoint,
  locate: (item: T) => GeoPoint,
): WithDistance<T>[] {
  return items
    .map((item) => ({ item, distanceKm: haversineKm(origin, locate(item)) }))
    .sort((a, b) => a.distanceKm - b.distanceKm);
}
