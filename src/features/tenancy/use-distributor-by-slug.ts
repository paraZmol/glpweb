import { getDistributorBySlug } from '../../data/distributors-repo';
import { isValidSlug, normalizeSlug } from '../../domain/tenancy/slug';
import type { PublicDistributor } from '../../domain/tenancy/types';
import { type ReloadableResource, useAsyncResource } from '../../lib/use-async-resource';

/**
 * The distributor behind `/d/{slug}` (PLAN 2.5), for visitors with or without a session.
 * `data` is null when no distributor has that link: show "no encontrada". One that is not
 * taking orders still loads: check `distributor.acceptingOrders` to show it as unavailable. The
 * page cannot know why (suspended, payment pending, trial over), and must not say (PLAN 2.9).
 * Two reads (slug, then distributor); a malformed slug costs none.
 */
export function useDistributorBySlug(slug: string): ReloadableResource<PublicDistributor | null> {
  const normalized = normalizeSlug(slug);
  return useAsyncResource(normalized, () =>
    isValidSlug(normalized) ? getDistributorBySlug(normalized) : Promise.resolve(null),
  );
}
