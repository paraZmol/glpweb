import { type GeoPoint, isValidGeoPoint } from '@/domain/geo/distance';

// The last point the person searched from, remembered on this device so the list of
// distributors is there on the next visit (PLAN 2.6). It never travels to the account or to the
// server. Signing out forgets it (see `endSession`): it is a location, and the device may be
// shared.
const KEY = 'hornilla.lastLocation';
const STORED_DECIMALS = 5; // about one metre

export const LOCATION_SOURCES = ['device', 'manual'] as const;
/** Where the point came from: the device said it, or the person typed it. */
export type LocationSource = (typeof LOCATION_SOURCES)[number];

export interface RememberedLocation {
  point: GeoPoint;
  source: LocationSource;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Whatever is in storage is checked like any other outside data before it is trusted. */
export function parseRememberedLocation(raw: string | null): RememberedLocation | null {
  if (raw === null) return null;
  try {
    const stored: unknown = JSON.parse(raw);
    if (!isRecord(stored)) return null;
    const { lat, lng, source } = stored;
    if (typeof lat !== 'number' || typeof lng !== 'number') return null;
    const isKnownSource = (LOCATION_SOURCES as readonly unknown[]).includes(source);
    if (!isKnownSource || !isValidGeoPoint({ lat, lng })) return null;
    return { point: { lat, lng }, source: source as LocationSource };
  } catch {
    return null;
  }
}

export function serializeLocation({ point, source }: RememberedLocation): string {
  return JSON.stringify({
    lat: Number(point.lat.toFixed(STORED_DECIMALS)),
    lng: Number(point.lng.toFixed(STORED_DECIMALS)),
    source,
  });
}

export function readLastLocation(): RememberedLocation | null {
  try {
    return parseRememberedLocation(localStorage.getItem(KEY));
  } catch {
    return null; // storage blocked: nothing was remembered
  }
}

export function rememberLastLocation(location: RememberedLocation): void {
  try {
    localStorage.setItem(KEY, serializeLocation(location));
  } catch {
    // Blocked or full storage: the location simply lasts for this visit only.
  }
}

export function forgetLastLocation(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Blocked storage: there is nothing to forget.
  }
}
