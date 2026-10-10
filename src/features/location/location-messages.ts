import type { GeolocationFailureReason } from '../../lib/geolocation';

/** Why the device did not say where it is, and what to do instead. Never a dead end. */
export const GEOLOCATION_FAILURE_TEXT: Record<GeolocationFailureReason, string> = {
  denied:
    'No tenemos permiso para ver tu ubicación. Puedes darlo en los ajustes de tu navegador, o escribir el punto a mano aquí abajo.',
  unavailable:
    'Tu dispositivo no pudo ubicarte ahora. Revisa que la ubicación esté encendida, o escribe el punto a mano.',
  timeout: 'La ubicación tardó demasiado. Vuelve a intentar, o escribe el punto a mano.',
  unsupported: 'Este navegador no comparte la ubicación. Escribe el punto a mano.',
};
