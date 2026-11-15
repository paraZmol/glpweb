import type { ReactNode } from 'react';
import { StateChip } from '@/components/common/state-chip';
import { Bone, LoadingRegion } from '@/components/common/skeleton';
import { type Product, productTitle } from '@/domain/catalog/product';
import { type Promotion, promotionBadge, promotionStateOf } from '@/domain/pricing/promotion';
import { DEFAULT_TIMEZONE } from '@/domain/tenancy/constants';
import {
  datesLine,
  dealSummary,
  maxPerOrderText,
  SALE_MODE_ONLY,
  STATE_CHIPS,
  withStop,
} from '@/features/promotions/promotion-texts';
import { cn } from '@/lib/utils';

/** The seal the system sets (H11): ají, never the colour of the brand. */
export function PromotionBadge({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full bg-aji px-2.5 py-0.5 text-[0.8125rem] font-bold whitespace-nowrap text-aji-foreground tabular-nums',
        className,
      )}
    >
      {children}
    </span>
  );
}

type PromotionCardProps = {
  promotion: Promotion;
  /** The whole catalogue, to name its products. */
  products: readonly Product[];
  now: Date;
  currency: string;
  /** The staff's buttons and questions; nothing for whoever only reads. */
  children?: ReactNode;
};

/**
 * One promotion as the staff sees it (marketing §4, "Lista de promociones"): its name and seal,
 * where it stands, what it gives and to which products, the caps and the dates. Everything the
 * customer is told is here too, whole (H4).
 */
export function PromotionCard({
  promotion,
  products,
  now,
  currency,
  children,
}: PromotionCardProps) {
  const state = promotionStateOf(promotion, now);
  const chip = STATE_CHIPS[state];
  const names = promotion.productIds.map((id) => {
    const product = products.find((item) => item.id === id);
    return product ? productTitle(product) : 'Producto retirado';
  });
  const isOver = state === 'ended' || state === 'switchedOff';

  return (
    <article className="flex flex-col gap-3 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3
          className={cn(
            'mr-auto text-lg font-bold wrap-anywhere',
            isOver && 'text-muted-foreground',
          )}
        >
          {promotion.title}
        </h3>
        <PromotionBadge>{promotionBadge(promotion.deal, currency)}</PromotionBadge>
        <StateChip state={chip.state}>{chip.label}</StateChip>
      </div>
      <p className="font-heading font-bold">
        {dealSummary(promotion.deal, promotion.saleMode, currency)}
      </p>
      <ul className="flex flex-col gap-0.5 text-[0.9375rem]">
        {names.map((name, index) => (
          <li key={promotion.productIds[index]} className="font-semibold">
            {name}
          </li>
        ))}
      </ul>
      <p className="text-[0.9375rem] text-muted-foreground tabular-nums">
        {SALE_MODE_ONLY[promotion.saleMode]} · {maxPerOrderText(promotion.maxUnitsPerOrder)}
        {promotion.totalUnits !== null &&
          ` · Tope total ${promotion.totalUnits} · Vendidas ${promotion.soldUnits}`}
      </p>
      <p className="text-[0.9375rem] font-semibold">
        {withStop(datesLine(promotion, state, now, DEFAULT_TIMEZONE))}
      </p>
      {promotion.conditions && (
        <p className="text-[0.9375rem] text-muted-foreground wrap-anywhere">
          Condiciones: {promotion.conditions}
        </p>
      )}
      {children}
    </article>
  );
}

export function PromotionListSkeleton() {
  return (
    <LoadingRegion label="Cargando las promociones" className="flex flex-col divide-y">
      {[0, 1].map((index) => (
        <div key={index} className="flex flex-col gap-2.5 py-4">
          <div className="flex gap-2">
            <Bone className="mr-auto h-6 w-48" />
            <Bone className="h-6 w-16 rounded-full" />
          </div>
          <Bone className="h-5 w-64 max-w-full" />
          <Bone className="h-4 w-56 max-w-full" />
          <Bone className="h-4 w-72 max-w-full" />
        </div>
      ))}
    </LoadingRegion>
  );
}
