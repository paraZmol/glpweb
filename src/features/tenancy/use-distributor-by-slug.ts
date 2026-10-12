import { getDistributorBySlug } from '../../data/distributors-repo';
import { isValidSlug, normalizeSlug } from '../../domain/tenancy/slug';
import type { PublicDistributor } from '../../domain/tenancy/types';
import { type ReloadableResource, useAsyncResource } from '../../lib/use-async-resource';

/**
 * The distributor behind `/d/{slug}` (PLAN 2.5), for visitors with or without a session.
 * `data` is null when no distributor has that link AND when the one that has it is not open to
 * the public (waiting for its review, suspended, payment pending, trial over): show "no
 * encontrada" for both. A visitor must not learn which case it is, nor the name or the phones
 * of a distributor the platform has not approved (PLAN 2.9, 2.11). Its own staff and platform
 * admins do get it, with `acceptingOrders: false`: show them the page as "not visible yet".
 * Two reads (slug, then distributor); a malformed slug costs none.
 */
export function useDistributorBySlug(slug: string): ReloadableResource<PublicDistributor | null> {
  const normalized = normalizeSlug(slug);
  return useAsyncResource(normalized, () =>
    isValidSlug(normalized) ? getDistributorBySlug(normalized) : Promise.resolve(null),
  );
}
