import { useCallback, useState } from 'react';
import { parseCoordinates } from '../../domain/geo/coordinates';
import {
  GeolocationFailure,
  type GeolocationFailureReason,
  requestCurrentPosition,
} from '../../lib/geolocation';
import {
  forgetLastLocation,
  readLastLocation,
  rememberLastLocation,
  type RememberedLocation,
} from '../../lib/last-location';

export type LocateState =
  | { status: 'idle' }
  | { status: 'locating' }
  | { status: 'failed'; reason: GeolocationFailureReason };

export interface DeliveryLocation {
  /** Where the person wants the gas, or null until they say. */
  location: RememberedLocation | null;
  locateState: LocateState;
  /**
   * Asks the device where it is. The browser shows its permission prompt here, so call it only
   * from a button the person tapped. A refusal is not an error of the app: `locateState` says
   * why and the manual way stays open.
   */
  locate: () => void;
  /** Takes a point typed by hand; false when the text holds no coordinates. */
  enterManually: (text: string) => boolean;
  forget: () => void;
}

/**
 * The point the search of distributors works from (PLAN 2.6): the last one used on this device,
 * the device's own position when the person asks for it, or coordinates typed by hand while
 * there is no map (phase 6) nor address search (step 4.1). It never asks for the permission by
 * itself and it never sends the point anywhere: the list is filtered in the browser.
 */
export function useDeliveryLocation(): DeliveryLocation {
  const [location, setLocation] = useState<RememberedLocation | null>(readLastLocation);
  const [locateState, setLocateState] = useState<LocateState>({ status: 'idle' });

  const use = useCallback((next: RememberedLocation) => {
    rememberLastLocation(next);
    setLocation(next);
    setLocateState({ status: 'idle' });
  }, []);

  const locate = useCallback(() => {
    setLocateState({ status: 'locating' });
    requestCurrentPosition().then(
      (point) => use({ point, source: 'device' }),
      (error: unknown) => {
        const reason = error instanceof GeolocationFailure ? error.reason : 'unavailable';
        setLocateState({ status: 'failed', reason });
      },
    );
  }, [use]);

  const enterManually = useCallback(
    (text: string) => {
      const point = parseCoordinates(text);
      if (point) use({ point, source: 'manual' });
      return point !== null;
    },
    [use],
  );

  const forget = useCallback(() => {
    forgetLastLocation();
    setLocation(null);
    setLocateState({ status: 'idle' });
  }, []);

  return { location, locateState, locate, enterManually, forget };
}
