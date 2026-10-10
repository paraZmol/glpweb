import { getDistributorBySlug } from '../../data/distributors-repo';
import { isValidSlug, normalizeSlug } from '../../domain/tenancy/slug';
import type { Distributor } from '../../domain/tenancy/types';
import { type ReloadableResource, useAsyncResource } from '../../lib/use-async-resource';

/**
 * The distributor behind `/d/{slug}` (PLAN 2.5), for visitors with or without a session.
 * `data` is null when no distributor has that link: show "no encontrada". A suspended or
 * expired one still loads; check `isWritable(distributor, now)` to show it as unavailable.
 * Two reads (slug, then distributor); a malformed slug costs none.
 */
export function useDistributorBySlug(slug: string): ReloadableResource<Distributor | null> {
  const normalized = normalizeSlug(slug);
  return useAsyncResource(normalized, () =>
    isValidSlug(normalized) ? getDistributorBySlug(normalized) : Promise.resolve(null),
  );
}
