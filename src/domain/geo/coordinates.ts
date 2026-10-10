import { type GeoPoint, isValidGeoPoint } from './distance';

// Two decimal numbers in a row: "-12.0464, -77.0428", but also the pair inside a link shared
// from a maps app (".../@-12.0464,-77.0428,17z"). Decimals are required so that a street number
// or a zoom level is never read as a coordinate.
const PAIR_PATTERN = /(-?\d{1,2}\.\d+)\s*[,;\s]\s*(-?\d{1,3}\.\d+)/;
const SHOWN_DECIMALS = 4; // about 11 m: enough to recognise a spot

/**
 * Reads a point typed or pasted by hand (PLAN 2.6, while there is no map or address search).
 * Latitude comes first, as every maps app writes it. Null when the text holds no usable pair.
 */
export function parseCoordinates(text: string): GeoPoint | null {
  const [, lat, lng] = PAIR_PATTERN.exec(text) ?? [];
  if (lat === undefined || lng === undefined) return null;
  const point = { lat: Number(lat), lng: Number(lng) };
  return isValidGeoPoint(point) ? point : null;
}

/** `-12.0464, -77.0428`: how a point is shown when there is no address to name it. */
export function formatCoordinates(point: GeoPoint): string {
  return `${point.lat.toFixed(SHOWN_DECIMALS)}, ${point.lng.toFixed(SHOWN_DECIMALS)}`;
}

const WHOLE_KM_FROM = 10;

/** `0,8 km`, `2,3 km`, `12 km` (ui-system §4): one decimal with a comma, none from 10 km up. */
export function formatDistanceKm(distanceKm: number): string {
  const km = Math.max(0, distanceKm);
  const tenths = Math.round(km * 10) / 10;
  if (tenths >= WHOLE_KM_FROM) return `${Math.round(km)} km`;
  return `${tenths.toFixed(1).replace('.', ',')} km`;
}
