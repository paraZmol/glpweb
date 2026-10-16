import type { MemberRole } from '../tenancy/types';

/**
 * Who creates, publishes, renames, extends and switches off promotions (PLAN 3.5, §11
 * 2026-10-16): the owner only, pending the user's word on the dispatcher. Every member of the
 * staff reads them (the dispatcher prices phone orders with them, D14). firebase/firestore.rules
 * holds the same list in the write rules of `promotions`.
 */
export const PROMOTION_EDITOR_ROLES = ['owner'] as const satisfies readonly MemberRole[];

export function canManagePromotions(role: MemberRole): boolean {
  return (PROMOTION_EDITOR_ROLES as readonly MemberRole[]).includes(role);
}
