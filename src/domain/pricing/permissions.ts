import type { MemberRole } from '../tenancy/types';

/**
 * Who creates, publishes, renames, extends and switches off promotions (PLAN 3.5; decision of
 * the user, §11 2026-10-16): the owner and the dispatcher, as with the prices. The driver only
 * reads them. firebase/firestore.rules holds the same list in the write rules of `promotions`.
 */
export const PROMOTION_EDITOR_ROLES = [
  'owner',
  'dispatcher',
] as const satisfies readonly MemberRole[];

export function canManagePromotions(role: MemberRole): boolean {
  return (PROMOTION_EDITOR_ROLES as readonly MemberRole[]).includes(role);
}
