import type { SaleMode } from '../../domain/catalog/sale-mode';
import { formatMoney } from '../../domain/money/format';
import type { Promotion, PromotionDeal, PromotionState } from '../../domain/pricing/promotion';
import { describeDay, describeValidity } from '../../domain/pricing/validity';
import { formatTimeOfDay } from '../../domain/tenancy/schedule';

// Texts of a saved promotion for the staff (docs/marketing/oferta-y-promociones.md §3.1 and §4,
// "Lista de promociones"). Never a countdown, never "últimas unidades" (H5).

/** "Solo recarga" or "Solo balón completo": what the promotion applies to (H4). */
export const SALE_MODE_ONLY: Record<SaleMode, string> = {
  refill: 'Solo recarga',
  full: 'Solo balón completo',
};

/** "cada recarga" / "cada balón completo" */
export const SALE_MODE_UNIT: Record<SaleMode, string> = {
  refill: 'recarga',
  full: 'balón completo',
};

/** What the deal gives, in one line: "S/ 5 menos en cada recarga". */
export function dealSummary(deal: PromotionDeal, saleMode: SaleMode, currency = 'PEN'): string {
  const unit = SALE_MODE_UNIT[saleMode];
  switch (deal.type) {
    case 'fixedPrice':
      return deal.priceSource === 'refill'
        ? 'Balón completo al precio de la recarga: el envase no se cobra'
        : `Precio especial: ${formatMoney(deal.priceCents, currency)} por ${unit}`;
    case 'percentOff':
      return `${deal.percent} % menos en cada ${unit}`;
    case 'amountOff':
      return `${formatMoney(deal.amountCents, currency)} menos en cada ${unit}`;
    case 'buyXPayY':
      return `Lleva ${deal.buyUnits}, paga ${deal.payUnits}`;
  }
}

/** The chip of each state, with a system state (never the brand). */
export const STATE_CHIPS: Record<
  PromotionState,
  { label: string; state: 'free' | 'busy' | 'paused' | 'offline' }
> = {
  live: { label: 'Activa', state: 'free' },
  scheduled: { label: 'Programada', state: 'busy' },
  draft: { label: 'Sin publicar', state: 'paused' },
  soldOut: { label: 'Llegó a su tope', state: 'paused' },
  ended: { label: 'Terminó', state: 'offline' },
  switchedOff: { label: 'Apagada', state: 'offline' },
};

function timeOf(instant: Date, timeZone: string): string {
  const hhmm = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(instant);
  return formatTimeOfDay(hhmm);
}

/** "el domingo 18 de octubre, 8:00 p. m." */
export function whenText(instant: Date, timeZone: string): string {
  return `el ${describeDay(instant, timeZone)}, ${timeOf(instant, timeZone)}`;
}

/** The line of dates of each state: when it ends, starts, ended or was switched off. */
export function datesLine(
  promotion: Promotion,
  state: PromotionState,
  now: Date,
  timeZone: string,
) {
  switch (state) {
    case 'live':
    case 'soldOut':
      return describeValidity(promotion, now, timeZone);
    case 'scheduled':
      return `Empieza ${whenText(promotion.startsAt, timeZone)} y termina ${whenText(promotion.endsAt, timeZone)}`;
    case 'draft':
      return `Si la publicas, dura hasta ${whenText(promotion.endsAt, timeZone)}`;
    case 'ended':
      return `Terminó ${whenText(promotion.endsAt, timeZone)}`;
    case 'switchedOff':
      return `Se apagó ${whenText(promotion.switchedOffAt ?? promotion.endsAt, timeZone)}`;
  }
}

/** Ends `text` with one full stop: the dates end in "p. m." already. */
export const withStop = (text: string) => (text.endsWith('.') ? text : `${text}.`);

/** "Máximo 2 por pedido" */
export const maxPerOrderText = (units: number) => `Máximo ${units} por pedido`;
