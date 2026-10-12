import { getDistributor } from '../../data/distributors-repo';
import type { Member } from '../../domain/tenancy/types';
import { useAsyncResource } from '../../lib/use-async-resource';

/** id → name for the memberships that already carry the name of their distributor. */
export function namesFromMemberships(memberships: readonly Member[]): Record<string, string> {
  return Object.fromEntries(
    memberships
      .filter((membership) => membership.distributorName !== '')
      .map((membership) => [membership.distributorId, membership.distributorName]),
  );
}

/**
 * Names for the distributor selector (PLAN 2.4, 2.9). Every member document carries the name
 * of its distributor, so this costs NO read; `membership.distributorName` can be used directly.
 * Only a membership written before that field existed is looked up in the public document.
 * Returns id → name; a name still being looked up is missing (the selector then falls back).
 */
export function useMembershipDistributorNames(
  memberships: readonly Member[],
): Record<string, string> {
  const known = namesFromMemberships(memberships);
  const unnamed = memberships
    .map((membership) => membership.distributorId)
    .filter((id) => !(id in known))
    .sort();
  const key = unnamed.length > 0 ? unnamed.join('|') : null;

  const looked = useAsyncResource(key, async () => {
    const distributors = await Promise.all(unnamed.map((id) => getDistributor(id)));
    return Object.fromEntries(
      distributors.flatMap((distributor) =>
        distributor ? [[distributor.id, distributor.name]] : [],
      ),
    );
  });

  return looked.status === 'ready' ? { ...known, ...looked.data } : known;
}
