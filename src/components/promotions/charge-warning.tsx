import { Info, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/common/button';
import { CheckboxField } from '@/components/common/checkbox-field';
import { type Product, productTitle } from '@/domain/catalog/product';
import type { SaleMode } from '@/domain/catalog/sale-mode';
import { formatMoney } from '@/domain/money/format';
import type { PreviewLevel, PreviewRow } from '@/domain/pricing/preview';
import type { PromotionDeal } from '@/domain/pricing/promotion';
import { SALE_MODE_UNIT } from '@/features/promotions/promotion-texts';
import { ICON_STROKE } from '@/lib/icons';
import { cn } from '@/lib/utils';

const EXAMPLE_UNITS = 20;
const TONES: Record<PreviewLevel, string> = {
  normal: 'bg-muted',
  attention: 'bg-[color-mix(in_srgb,var(--state-paused)_14%,var(--card))]',
  risk: 'bg-[color-mix(in_srgb,var(--state-danger)_12%,var(--card))]',
};

type ChargeWarningProps = {
  deal: PromotionDeal;
  saleMode: SaleMode;
  rows: readonly PreviewRow[];
  level: PreviewLevel;
  products: readonly Product[];
  totalUnits: number | null;
  currency: string;
  acceptsRisk: boolean;
  onAcceptsRisk: (accepts: boolean) => void;
  /** "Publicar" was pressed without the box: said under it, and the warning comes into view. */
  riskError?: string;
  /** "Lleva 2, paga 1" offers to switch to "lleva 3, paga 2" (marketing §4, step 3). */
  onSoften?: () => void;
};

const isEmptyBottle = (deal: PromotionDeal) =>
  deal.type === 'fixedPrice' && deal.priceSource === 'refill';

/** "cada recarga", "cada 3 balones completos". */
function perText(units: number, saleMode: SaleMode): string {
  if (units === 1) return `cada ${SALE_MODE_UNIT[saleMode]}`;
  return `cada ${units} ${saleMode === 'refill' ? 'recargas' : 'balones completos'}`;
}

/**
 * "Dejas de cobrar…" (marketing §4, step 3), always above the buttons, in four short lines: what
 * a unit stops being charged, list price against promotion price, what 20 (or the cap) add up
 * to, and, when strong, to check the cost. Hornilla knows no costs: it never speaks of profit.
 */
export function ChargeWarning(props: ChargeWarningProps) {
  const { deal, saleMode, rows, level, products, totalUnits, currency, riskError } = props;
  const top = rows[0];
  if (!top) return null;
  const money = (cents: number) => formatMoney(cents, currency);
  const sold = totalUnits ?? EXAMPLE_UNITS;
  const isStrong = level !== 'normal';
  const Icon = isStrong ? TriangleAlert : Info;
  const title = isEmptyBottle(deal)
    ? 'Entregas el envase sin cobrarlo.'
    : `Dejas de cobrar ${money(top.discountCents)} por ${perText(top.units, saleMode)}.`;

  return (
    <section
      aria-label="Lo que dejas de cobrar"
      data-invalid={riskError ? 'true' : undefined}
      tabIndex={riskError ? -1 : undefined}
      className={cn(
        'flex scroll-mt-[calc(var(--top-inset)+1rem)] flex-col gap-2 rounded-lg p-4',
        TONES[level],
      )}
    >
      <p
        className={cn(
          'flex items-start gap-2 tabular-nums',
          isStrong ? 'font-heading text-lg leading-tight font-bold' : 'font-semibold',
        )}
      >
        <Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0" strokeWidth={ICON_STROKE} />
        {title}
      </p>
      <ul className="flex flex-col gap-0.5 text-[0.9375rem] tabular-nums">
        {rows.map((row) => {
          const product = products.find((item) => item.id === row.productId);
          return (
            <li key={row.productId}>
              {rows.length > 1 && (
                <strong className="font-semibold">
                  {product ? productTitle(product) : row.productId}:{' '}
                </strong>
              )}
              {row.units > 1 && `${row.units} por `}
              Precio de lista {money(row.listPriceCents * row.units)} → con la promoción{' '}
              {money(row.promoTotalCents)} ({row.percent} % menos).
            </li>
          );
        })}
      </ul>
      <p className="text-[0.9375rem] tabular-nums">
        Si vendes {sold}, dejas de cobrar {money(Math.floor(sold / top.units) * top.discountCents)}.
      </p>
      {isEmptyBottle(deal) && (
        <p className="text-[0.9375rem] text-muted-foreground">
          Cada venta saca un balón de tu stock y no vuelve un vacío. Es 1 por pedido, pero quien lo
          recibe puede volver a pedir.
        </p>
      )}
      {isStrong && <p className="font-semibold">Revisa que cubra tu costo.</p>}
      {props.onSoften && (
        <Button
          type="button"
          variant="line"
          size="sm"
          className="self-start"
          onClick={props.onSoften}
        >
          Cambiar a Lleva 3, paga 2
        </Button>
      )}
      {level === 'risk' && (
        <CheckboxField
          name="acceptsRisk"
          className="mt-1"
          checked={props.acceptsRisk}
          error={riskError}
          onChange={(event) => props.onAcceptsRisk(event.target.checked)}
        >
          <strong className="font-semibold">Entiendo y quiero publicarla</strong>
        </CheckboxField>
      )}
    </section>
  );
}
