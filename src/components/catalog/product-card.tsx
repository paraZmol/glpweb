import type { ReactNode } from 'react';
import { GasBrandTheme } from '@/components/brand/brand-theme';
import { GasCylinder } from '@/components/brand/gas-cylinder';
import { availableSaleMode, type ProductOffer, type SaleMode } from '@/domain/catalog/sale-mode';
import { formatMoney } from '@/domain/money/format';
import { SALE_MODE_SUPPORT, SaleModeSelector } from './sale-mode-selector';

const REFILL_ONLY_NOTE = 'Solo recarga. Esta distribuidora no vende envases de este balón.';
const CYLINDER_HEIGHT_PX = 92;

type ProductCardProps = {
  product: ProductOffer;
  /** Refill on arrival; the card shows refill anyway when the product has no full price. */
  mode: SaleMode;
  onModeChange: (mode: SaleMode) => void;
  /** Where the +/− stepper will go once orders exist (phase 4). */
  action?: ReactNode;
};

/**
 * One product of a distributor (PLAN 2.5, ready for the catalogue of phase 3): the cylinder
 * drawn in the colour of its gas brand, and the choice between refill and full cylinder with
 * the price of each (docs/marketing/oferta-y-promociones.md §2.2). The page of the distributor
 * does not render it yet: there is no catalogue to feed it.
 */
export function ProductCard({ product, mode, onModeChange, action }: ProductCardProps) {
  const { weightKg, brandName, refillPriceCents, fullPriceCents, currency } = product;
  const shownMode = availableSaleMode(product, mode);
  const name = `Balón ${weightKg} kg`;

  return (
    <GasBrandTheme color={product.brandColor} className="h-full">
      <article className="flex h-full gap-3 rounded-xl bg-card p-3 shadow-card lg:flex-col lg:p-4">
        <div className="grid w-22 shrink-0 place-items-end justify-center rounded-[1.25rem] bg-gas-brand-soft pb-1 lg:h-44 lg:w-full">
          <GasCylinder weightKg={weightKg} height={CYLINDER_HEIGHT_PX} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div>
            <h3 className="text-xl font-bold">{name}</h3>
            <p className="flex items-center gap-1.5 text-[0.9375rem] font-semibold text-muted-foreground">
              <span aria-hidden="true" className="size-2.5 rounded-full bg-gas-brand" />
              {brandName}
            </p>
          </div>
          {fullPriceCents === null ? (
            <p className="font-heading text-2xl font-extrabold tabular-nums">
              {formatMoney(refillPriceCents, currency)}
            </p>
          ) : (
            <SaleModeSelector
              label={`${name} ${brandName}`}
              mode={shownMode}
              onChange={onModeChange}
              priceCents={{ refill: refillPriceCents, full: fullPriceCents }}
              currency={currency}
            />
          )}
          <p className="text-sm text-muted-foreground">
            {fullPriceCents === null ? REFILL_ONLY_NOTE : SALE_MODE_SUPPORT[shownMode]}
          </p>
          {action && <div className="mt-auto flex justify-end">{action}</div>}
        </div>
      </article>
    </GasBrandTheme>
  );
}
