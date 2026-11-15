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
  /** "Lleva 2, paga 1" offers to switch to "lleva 3, paga 2" (marketing §4, step 3). */
  onSoften?: () => void;
};

function headlineOf(deal: PromotionDeal, level: PreviewLevel): string | null {
  if (deal.type === 'fixedPrice' && deal.priceSource === 'refill')
    return 'Vas a entregar el envase sin cobrarlo.';
  if (deal.type === 'buyXPayY' && deal.payUnits * 2 === deal.buyUnits)
    return 'Uno de cada dos balones sale gratis.';
  if (level === 'risk') return 'Es una rebaja muy fuerte.';
  return level === 'attention' ? 'Es una rebaja fuerte.' : null;
}

/**
 * "Dejas de cobrar…" (marketing §4, step 3), always above the button: Hornilla knows no costs,
 * so it speaks of what stops being charged, never of profit. A row per product, the largest
 * first; strong discounts ask to check the cost, risky ones ask for a tick before publishing.
 */
export function ChargeWarning(props: ChargeWarningProps) {
  const { deal, saleMode, rows, level, products, totalUnits, currency } = props;
  const top = rows[0];
  if (!top) return null;
  const money = (cents: number) => formatMoney(cents, currency);
  const per =
    top.units === 1
      ? `cada ${SALE_MODE_UNIT[saleMode]}`
      : `cada ${top.units} ${saleMode === 'refill' ? 'recargas' : 'balones completos'}`;
  const sold = totalUnits ?? EXAMPLE_UNITS;
  const headline = headlineOf(deal, level);
  const Icon = level === 'normal' ? Info : TriangleAlert;

  return (
    <section
      aria-label="Lo que dejas de cobrar"
      className={cn('flex flex-col gap-2 rounded-lg p-4', TONES[level])}
    >
      {headline && (
        <p className="flex items-start gap-2 font-heading text-lg leading-tight font-bold">
          <Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0" strokeWidth={ICON_STROKE} />
          {headline}
        </p>
      )}
      <p className="font-semibold tabular-nums">
        Dejas de cobrar {money(top.discountCents)} por {per} ({top.percent} %).
        {level !== 'normal' && ' Revisa que cubra tu costo.'}
      </p>
      {deal.type === 'fixedPrice' && deal.priceSource === 'refill' && (
        <p className="text-[0.9375rem]">
          Cada venta saca un balón de tu stock y no vuelve un vacío. Hornilla limita 1 por pedido,
          pero una misma persona puede volver a pedir cuando reciba el anterior.
        </p>
      )}
      <ul className="flex flex-col gap-0.5 text-[0.9375rem] tabular-nums">
        {rows.map((row) => {
          const product = products.find((item) => item.id === row.productId);
          return (
            <li key={row.productId}>
              {product ? productTitle(product) : row.productId}:{' '}
              {row.units > 1 && `${row.units} por `}
              {money(row.listPriceCents * row.units)} → {money(row.promoTotalCents)}
            </li>
          );
        })}
      </ul>
      <p className="text-[0.9375rem] text-muted-foreground tabular-nums">
        Si vendes {sold} con la promoción: {money(Math.floor(sold / top.units) * top.discountCents)}{' '}
        menos.
      </p>
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
          checked={props.acceptsRisk}
          onChange={(event) => props.onAcceptsRisk(event.target.checked)}
        >
          <strong className="font-semibold">Entiendo y quiero publicarla</strong>
        </CheckboxField>
      )}
    </section>
  );
}
