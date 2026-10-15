import type { MemberRole } from '../tenancy/types';

/**
 * Who sets the products and the prices of a distributor (PLAN §11, 2026-10-15: the dispatcher
 * too, not only the owner). The driver only reads them. firebase/firestore.rules holds the same
 * list in the write rules of `products`.
 */
export const CATALOG_EDITOR_ROLES = [
  'owner',
  'dispatcher',
] as const satisfies readonly MemberRole[];

export function canEditCatalog(role: MemberRole): boolean {
  return (CATALOG_EDITOR_ROLES as readonly MemberRole[]).includes(role);
}
