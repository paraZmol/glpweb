// Limits of the vehicles (PLAN 3.3), shared by the forms, the repositories and
// firebase/firestore.rules. The rules cannot import this file: when a value changes here, change
// it there too. The rules tests in firebase/tests read these constants, so a mismatch fails.

/**
 * Vehicles per distributor. Each one lives in a fixed slot (`v00` … `v29`), the only way the
 * rules can cap a collection without a server. A vehicle is never deleted, only switched off:
 * a shift (phase 5) names it by its slot.
 */
export const MAX_VEHICLES = 30;

/** Upper bound of every query of the vehicles; the rules refuse a larger `limit`. */
export const VEHICLES_QUERY_LIMIT = MAX_VEHICLES;

export const VEHICLE_NAME_MAX_LENGTH = 40;

/** A plate as stored: "ABC-123", "A1B234", "1234-AB". */
export const PLATE_MIN_LENGTH = 3;
export const PLATE_MAX_LENGTH = 10;

/** Cylinders a vehicle carries in all, of any weight. 999 stands for "no practical limit". */
export const MIN_VEHICLE_CAPACITY = 1;
export const MAX_VEHICLE_CAPACITY = 999;
