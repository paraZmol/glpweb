import { EyeOff } from 'lucide-react';
import type { ReactNode } from 'react';
import { GasBrandTheme } from '@/components/brand/brand-theme';
import { GasCylinder } from '@/components/brand/gas-cylinder';
import { StateChip } from '@/components/common/state-chip';
import type { Product } from '@/domain/catalog/product';
import { formatMoney } from '@/domain/money/format';
import { GLYPH_STROKE } from '@/lib/icons';
import { cn } from '@/lib/utils';
import { SALE_MODE_NAMES } from './sale-mode-selector';

const CYLINDER_HEIGHT_PX = 52;
export const OFF_SALE = 'Fuera de venta';
export const ON_SALE = 'A la venta';
// Short form of marketing §2.1 for the staff: the full cylinder is never named without "envase".
const REFILL_ONLY = 'Solo recarga';
const FULL_NOTE = 'gas + envase';

function Price({ label, cents, currency, note }: PriceProps) {
  return (
    // Desktop: the price sits at the foot of its cell, so the two prices of a row share a line
    // even when the label of one wraps.
    <p className="flex items-baseline justify-between gap-3 lg:flex-col lg:items-start lg:justify-end lg:gap-0 lg:self-stretch">
      <span className="min-w-0 text-[0.8125rem] leading-tight font-semibold text-muted-foreground">
        {label}
        {note && (
          <span className="block font-normal lg:inline">
            <span className="max-lg:hidden"> · </span>
            {note}
          </span>
        )}
      </span>
      <span className="block shrink-0 font-heading text-lg font-extrabold whitespace-nowrap tabular-nums">
        {formatMoney(cents, currency)}
      </span>
    </p>
  );
}

type PriceProps = { label: string; cents: number; currency: string; note?: string };

/** "A la venta" with the system's free state, "Fuera de venta" as a neutral seal (not a state). */
export function SaleSeal({ isOnSale }: { isOnSale: boolean }) {
  if (isOnSale) return <StateChip state="free">{ON_SALE}</StateChip>;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-muted py-1 pr-2.5 pl-2 text-[0.8125rem] font-bold whitespace-nowrap text-muted-foreground">
      <EyeOff aria-hidden="true" className="size-3" strokeWidth={GLYPH_STROKE} />
      {OFF_SALE}
    </span>
  );
}

type CatalogRowProps = {
  product: Product;
  /** What the owner can do with it; nothing for whoever only reads the catalogue. */
  actions?: ReactNode;
};

/**
 * One product of the catalogue as its staff sees it (PLAN 3.1). Phone: the cylinder, the name
 * and both prices stacked, the actions underneath. Desktop: one dense row, prices in columns.
 */
export function CatalogRow({ product, actions }: CatalogRowProps) {
  const { name, brand, weightKg, refillPriceCents, fullPriceCents, currency, active } = product;
  return (
    <article
      className={cn(
        'grid grid-cols-[4rem_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-3 py-4',
        'lg:grid-cols-[3.5rem_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_auto]',
      )}
    >
      <GasBrandTheme color={product.brandColor} className="row-span-2 self-start lg:row-span-1">
        <div
          className={cn(
            'grid h-16 place-items-end justify-center rounded-lg bg-gas-brand-soft lg:h-14',
            !active && 'opacity-60',
          )}
        >
          <GasCylinder weightKg={weightKg} height={CYLINDER_HEIGHT_PX} />
        </div>
      </GasBrandTheme>
      <div className="flex min-w-0 flex-col items-start gap-1.5">
        {/* Never cut: with a name of its own the brand is what tells two products apart. */}
        <h3 className="max-w-full text-lg font-bold text-pretty wrap-break-word">
          {name} <span className="font-semibold text-muted-foreground">· {brand}</span>
        </h3>
        <SaleSeal isOnSale={active} />
      </div>
      {/* Phone: both prices stacked under the name, to the edge. Desktop: one column each. */}
      <div className="col-span-2 col-start-2 flex flex-col gap-1 lg:contents">
        <Price label={SALE_MODE_NAMES.refill} cents={refillPriceCents} currency={currency} />
        {fullPriceCents === null ? (
          <p className="text-[0.8125rem] font-semibold text-muted-foreground">{REFILL_ONLY}</p>
        ) : (
          <Price
            label={SALE_MODE_NAMES.full}
            note={FULL_NOTE}
            cents={fullPriceCents}
            currency={currency}
          />
        )}
      </div>
      {/* Phone: the actions place their own pieces in this grid (see CatalogRowActions). */}
      {actions && <div className="contents lg:block">{actions}</div>}
    </article>
  );
}
