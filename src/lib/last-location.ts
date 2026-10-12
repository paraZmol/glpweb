import { type GeoPoint, isValidGeoPoint } from '@/domain/geo/distance';

// The last point the person searched from, remembered on this device so the list of
// distributors is there on the next visit (PLAN 2.6). It never travels to the account or to the
// server. Signing out forgets it (see `endSession`): it is a location, and the device may be
// shared. A visitor without a session never signs out, so the point also expires by itself, and
// it is kept only as precise as the search needs (PLAN 2.11).
const KEY = 'hornilla.lastLocation';
/** About a hundred metres: enough to tell which distributors reach, not which door it is. */
export const STORED_DECIMALS = 3;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
/** A point nobody searched from again in this long is dropped the next time it is read. */
export const LOCATION_MAX_AGE_DAYS = 30;

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

/** Saved in the last `LOCATION_MAX_AGE_DAYS` days, and not in the future (a clock set back). */
function isFresh(savedAtMs: unknown, nowMs: number): boolean {
  if (typeof savedAtMs !== 'number' || !Number.isFinite(savedAtMs)) return false;
  const ageMs = nowMs - savedAtMs;
  return ageMs >= 0 && ageMs <= LOCATION_MAX_AGE_DAYS * MS_PER_DAY;
}

/**
 * Whatever is in storage is checked like any other outside data before it is trusted. A point
 * without a date (stored before PLAN 2.11, at one metre of precision) or older than the limit
 * is not handed over.
 */
export function parseRememberedLocation(
  raw: string | null,
  nowMs: number,
): RememberedLocation | null {
  if (raw === null) return null;
  try {
    const stored: unknown = JSON.parse(raw);
    if (!isRecord(stored)) return null;
    const { lat, lng, source, savedAt } = stored;
    if (typeof lat !== 'number' || typeof lng !== 'number') return null;
    if (!isFresh(savedAt, nowMs)) return null;
    const isKnownSource = (LOCATION_SOURCES as readonly unknown[]).includes(source);
    if (!isKnownSource || !isValidGeoPoint({ lat, lng })) return null;
    return { point: { lat, lng }, source: source as LocationSource };
  } catch {
    return null;
  }
}

/** The point as it is kept and searched from: rounded to `STORED_DECIMALS`. */
export function roundedPoint(point: GeoPoint): GeoPoint {
  return {
    lat: Number(point.lat.toFixed(STORED_DECIMALS)),
    lng: Number(point.lng.toFixed(STORED_DECIMALS)),
  };
}

export function serializeLocation({ point, source }: RememberedLocation, nowMs: number): string {
  return JSON.stringify({ ...roundedPoint(point), source, savedAt: nowMs });
}

/** The remembered point, or null; one that expired or cannot be read is removed on the spot. */
export function readLastLocation(nowMs: number = Date.now()): RememberedLocation | null {
  try {
    const raw = localStorage.getItem(KEY);
    const location = parseRememberedLocation(raw, nowMs);
    if (raw !== null && location === null) localStorage.removeItem(KEY);
    return location;
  } catch {
    return null; // storage blocked: nothing was remembered
  }
}

export function rememberLastLocation(
  location: RememberedLocation,
  nowMs: number = Date.now(),
): void {
  try {
    localStorage.setItem(KEY, serializeLocation(location, nowMs));
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
