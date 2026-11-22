// Limits of the staff (PLAN 3.2), shared by the forms, the repositories and
// firebase/firestore.rules. The rules cannot import this file: when a value changes here, change
// it there too. The rules tests in firebase/tests read these constants, so a mismatch fails.

/**
 * An invitation can be used for this many days after it was created. The rules count them from
 * its `createdAt`, which is server time: nobody can write a longer life into it.
 */
export const INVITE_TTL_DAYS = 7;

/**
 * Length of an invitation code: what the Firestore SDK generates for an automatic id (20 of 62
 * letters and digits, about 119 bits from the browser's cryptographic random source). The code
 * is the document id and the only secret of the invitation, so it is never shorter.
 */
export const INVITE_CODE_LENGTH = 20;

/** Upper bound of the owner's list of invitations; the rules refuse a larger `limit` (50). */
export const INVITES_QUERY_LIMIT = 20;

/** The rules' cap on any query of the invitations of a distributor. */
export const INVITES_QUERY_MAX = 50;

/** An e-mail address, as Google hands it over (RFC 5321 caps a path at 254). */
export const INVITE_EMAIL_MAX_LENGTH = 254;

/**
 * Helpers per distributor (people who go with a truck and never sign in). Each one lives in a
 * fixed slot (`h00` … `h29`), the only way the rules can cap a collection without a server.
 * A helper is never deleted, only deactivated: a shift (phase 5) will name it by its slot.
 */
export const MAX_HELPERS = 30;

/** Upper bound of every query of the helpers; the rules refuse a larger `limit`. */
export const HELPERS_QUERY_LIMIT = MAX_HELPERS;

export const HELPER_NAME_MAX_LENGTH = 60;
