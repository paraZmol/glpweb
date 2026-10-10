import type { Member, MemberRole } from './types';

/** Memberships the account can actually use: a deactivated member keeps the document. */
export function activeMemberships(memberships: readonly Member[]): Member[] {
  return memberships.filter((membership) => membership.active);
}

/**
 * Chooses which distributor the panels show: the remembered one if the account still belongs to
 * it, otherwise the first active membership (owner first), otherwise none.
 */
export function pickCurrentMembership(
  memberships: readonly Member[],
  rememberedDistributorId: string | null,
): Member | null {
  const usable = sortMemberships(activeMemberships(memberships));
  const remembered = usable.find(
    (membership) => membership.distributorId === rememberedDistributorId,
  );
  return remembered ?? usable[0] ?? null;
}

const ROLE_ORDER: Record<MemberRole, number> = { owner: 0, dispatcher: 1, driver: 2 };

/** Stable order for the selector: by role weight, then by distributor id. */
export function sortMemberships(memberships: readonly Member[]): Member[] {
  return [...memberships].sort(
    (a, b) =>
      ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || a.distributorId.localeCompare(b.distributorId),
  );
}

export function hasAnyRole(member: Member | null, roles: readonly MemberRole[]): boolean {
  return member !== null && member.active && roles.includes(member.role);
}
