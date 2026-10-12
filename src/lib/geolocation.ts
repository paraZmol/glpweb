import type { GeoPoint } from '@/domain/geo/distance';

/** Why the device could not say where it is. Each one has its own message on screen. */
export type GeolocationFailureReason = 'denied' | 'unavailable' | 'timeout' | 'unsupported';

export class GeolocationFailure extends Error {
  constructor(readonly reason: GeolocationFailureReason) {
    super(`Geolocation failed: ${reason}`);
    this.name = 'GeolocationFailure';
  }
}

const TIMEOUT_MS = 12_000;
/** Always a fresh reading: the person may have moved since the last one (tracking-pwa §2). */
const MAX_AGE_MS = 0;
// Codes of GeolocationPositionError (the constants are not reliable across browsers).
const PERMISSION_DENIED = 1;
const TIMED_OUT = 3;

function reasonOf(error: GeolocationPositionError): GeolocationFailureReason {
  if (error.code === PERMISSION_DENIED) return 'denied';
  return error.code === TIMED_OUT ? 'timeout' : 'unavailable';
}

/**
 * One reading of where the device is. CALLING THIS IS WHAT MAKES THE BROWSER ASK FOR THE
 * PERMISSION: only call it from the handler of a button the person tapped, after the screen
 * said what the location is for (tracking-pwa §1). Rejects with `GeolocationFailure`.
 */
export function requestCurrentPosition(): Promise<GeoPoint> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      reject(new GeolocationFailure('unsupported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ lat: coords.latitude, lng: coords.longitude }),
      (error) => reject(new GeolocationFailure(reasonOf(error))),
      { enableHighAccuracy: true, timeout: TIMEOUT_MS, maximumAge: MAX_AGE_MS },
    );
  });
}
