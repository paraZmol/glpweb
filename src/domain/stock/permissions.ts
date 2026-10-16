import type { MemberRole } from '../tenancy/types';

// PLAN §11, 2026-10-16 (decided by the user): the owner and the dispatcher adjust the plant
// stock; the driver only reads it. firebase/firestore.rules holds the same lists in `plantStock`
// and `stockMovements`.

/** Who reads the plant stock and its history of movements: the whole staff. */
export const STOCK_READER_ROLES = [
  'owner',
  'dispatcher',
  'driver',
] as const satisfies readonly MemberRole[];

/** Who adjusts the plant stock by hand. */
export const STOCK_ADJUSTER_ROLES = [
  'owner',
  'dispatcher',
] as const satisfies readonly MemberRole[];

export function canReadPlantStock(role: MemberRole): boolean {
  return (STOCK_READER_ROLES as readonly MemberRole[]).includes(role);
}

export function canAdjustPlantStock(role: MemberRole): boolean {
  return (STOCK_ADJUSTER_ROLES as readonly MemberRole[]).includes(role);
}
