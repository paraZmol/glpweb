import { listPromotions, listPublicPromotions } from '../../data/promotions-repo';
import type { Promotion } from '../../domain/pricing/promotion';
import { type ReloadableResource, useAsyncResource } from '../../lib/use-async-resource';
import { useRefreshOnReturn } from '../../lib/use-refresh-on-return';

/**
 * Every promotion slot of a distributor, for its staff (PLAN 3.5): `promotionStateOf` says which
 * is live, scheduled, a draft, ended or switched off. Not live: read on open and on return to the
 * screen. Cost per load: one read per promotion (one for none) plus 1 by the rules.
 */
export function usePromotions(distributorId: string | null): ReloadableResource<Promotion[]> {
  const promotions = useAsyncResource(distributorId && `promotions:${distributorId}`, () =>
    listPromotions(distributorId ?? ''),
  );
  useRefreshOnReturn(promotions.reload, distributorId !== null);
  return promotions;
}

/**
 * The published promotions not ended yet, for `/d/{slug}` and the search (marketing D13), with or
 * without a session. Show only those `isLive` at the moment of painting (a scheduled one comes
 * too). Cost per load: one read per promotion (one for none) plus 1 by the rules.
 */
export function usePublicPromotions(distributorId: string | null): ReloadableResource<Promotion[]> {
  return useAsyncResource(distributorId && `public-promotions:${distributorId}`, () =>
    listPublicPromotions(distributorId ?? '', new Date()),
  );
}
