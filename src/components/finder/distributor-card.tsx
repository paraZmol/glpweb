import { ChevronRight } from 'lucide-react';
import { BrandTheme } from '@/components/brand/brand-theme';
import { Monogram } from '@/components/brand/monogram';
import { ButtonLink } from '@/components/common/button';
import { Bone } from '@/components/common/skeleton';
import { StateChip } from '@/components/common/state-chip';
import { formatDistanceKm } from '@/domain/geo/coordinates';
import { formatMoney } from '@/domain/money/format';
import { DEFAULT_TIMEZONE } from '@/domain/tenancy/constants';
import type { NearbyDistributor } from '@/domain/tenancy/nearby';
import { describeOpenStatus, openStatusAt } from '@/domain/tenancy/schedule';
import type { PublicDistributor } from '@/domain/tenancy/types';
import { ICON_STROKE } from '@/lib/icons';
import { distributorPath } from '@/lib/routes';

/** Brands and "desde" price, only when the profile carries them (the catalogue is phase 3). */
function Offer({ distributor }: { distributor: PublicDistributor }) {
  const { brands, priceFromCents, currency } = distributor;
  if (brands.length === 0 && priceFromCents === null) {
    return (
      <p className="rounded-lg bg-muted p-3 text-[0.9375rem] text-muted-foreground">
        Todavía no publicó su catálogo.
      </p>
    );
  }
  return (
    <div className="flex items-end justify-between gap-3 rounded-lg bg-muted p-3">
      <p className="min-w-0 truncate text-[0.8125rem] font-semibold text-muted-foreground">
        {brands.join(' · ')}
      </p>
      {priceFromCents !== null && (
        <p className="shrink-0 text-right">
          <span className="block text-[0.8125rem] font-semibold text-muted-foreground">
            Recarga desde
          </span>
          <span className="font-heading text-2xl leading-none font-extrabold tabular-nums">
            {formatMoney(priceFromCents, currency)}
          </span>
        </p>
      )}
    </div>
  );
}

type DistributorCardProps = {
  entry: NearbyDistributor;
  /** The moment the list was drawn, to say whether each one attends right now. */
  now: Date;
  /** Only the nearest one carries the primary button. */
  isNearest: boolean;
};

/** One distributor that reaches the person's point, wearing its own colour (PLAN 2.6). */
export function DistributorCard({ entry, now, isNearest }: DistributorCardProps) {
  const { distributor, distanceKm } = entry;
  const status = openStatusAt(distributor.schedule, now, DEFAULT_TIMEZONE);

  return (
    <BrandTheme color={distributor.brandColor} className="h-full">
      <article className="flex h-full flex-col gap-3 rounded-xl bg-card p-4 shadow-card">
        <div className="flex items-start gap-3">
          <Monogram name={distributor.name} />
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-xl font-bold">{distributor.name}</h3>
            <p className="mt-1 text-sm font-semibold text-muted-foreground tabular-nums">
              a {formatDistanceKm(distanceKm)} de tu punto
            </p>
          </div>
        </div>
        <Offer distributor={distributor} />
        <div className="mt-auto flex flex-wrap items-center justify-between gap-3">
          <StateChip state={status.isOpen ? 'free' : 'offline'} className="tabular-nums">
            {describeOpenStatus(status)}
          </StateChip>
          <ButtonLink
            to={distributorPath(distributor.slug)}
            variant={isNearest ? 'primary' : 'line'}
            size="sm"
            className="ml-auto"
          >
            Ver distribuidora
            <span className="sr-only"> {distributor.name}</span>
            <ChevronRight aria-hidden="true" strokeWidth={ICON_STROKE} />
          </ButtonLink>
        </div>
      </article>
    </BrandTheme>
  );
}

/** The same shape while the list loads, so nothing jumps when it arrives (motion-system §2). */
export function DistributorCardSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-xl bg-card p-4 shadow-card">
      <div className="flex items-start gap-3">
        <Bone className="size-12 rounded-lg" />
        <div className="flex-1">
          <Bone className="h-5 w-40 max-w-full" />
          <Bone className="mt-2.5 h-4 w-28" />
        </div>
      </div>
      <Bone className="h-17 rounded-lg" />
      <div className="flex items-center justify-between gap-3">
        <Bone className="h-7 w-44 max-w-[55%] rounded-full" />
        <Bone className="h-10 w-40 max-w-[40%] rounded-full" />
      </div>
    </div>
  );
}
