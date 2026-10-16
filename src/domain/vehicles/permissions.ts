import type { MemberRole } from '../tenancy/types';

/**
 * Who adds and edits the vehicles of a distributor (PLAN §11, 2026-10-16, decided by the user:
 * the dispatcher too, like the catalogue). The driver only reads them.
 * firebase/firestore.rules holds the same list in the write rules of `vehicles`.
 */
export const VEHICLE_EDITOR_ROLES = [
  'owner',
  'dispatcher',
] as const satisfies readonly MemberRole[];

export function canEditVehicles(role: MemberRole): boolean {
  return (VEHICLE_EDITOR_ROLES as readonly MemberRole[]).includes(role);
}
