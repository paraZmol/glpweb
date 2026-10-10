import { getDistributor } from '../../data/distributors-repo';
import type { Member } from '../../domain/tenancy/types';
import { useAsyncResource } from '../../lib/use-async-resource';

const MIN_MEMBERSHIPS_FOR_SELECTOR = 2;

/**
 * Names for the distributor selector (PLAN 2.4): a member document does not carry the name of
 * its distributor, so each one is read from its public document. Nothing is read for an account
 * with a single distributor; the list is capped by the memberships query itself.
 * Returns id → name, empty while loading or when the read fails (the selector then falls back).
 */
export function useMembershipDistributorNames(
  memberships: readonly Member[],
): Record<string, string> {
  const ids = memberships.map((membership) => membership.distributorId).sort();
  const key = ids.length >= MIN_MEMBERSHIPS_FOR_SELECTOR ? ids.join('|') : null;

  const names = useAsyncResource(key, async () => {
    const distributors = await Promise.all(ids.map((id) => getDistributor(id)));
    return Object.fromEntries(
      distributors.flatMap((distributor) =>
        distributor ? [[distributor.id, distributor.name]] : [],
      ),
    );
  });

  return names.status === 'ready' ? names.data : {};
}
