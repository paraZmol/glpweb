/** A Firestore timestamp as the Admin SDK hands it over; only `toMillis` is read. */
interface Stamp {
  toMillis(): number;
}

/** The fields of an invitation the retention reads. */
export interface InviteDates {
  status?: string;
  createdAt?: Stamp;
  acceptedAt?: Stamp;
  revokedAt?: Stamp;
}

export const INVITE_EMAIL_RETENTION_DAYS: number;
export function closedAtOf(invite: InviteDates, nowMs: number): number | null;
export function isPastRetention(invite: InviteDates, nowMs: number): boolean;
