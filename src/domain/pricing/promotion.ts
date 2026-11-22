import type { SaleMode } from '../catalog/sale-mode';
import { formatMoney } from '../money/format';
import { MAX_PROMOTIONS } from './constants';

/**
 * A promotion of a distributor, stored at `/distributors/{d}/promotions/{slot}` (PLAN 3.5, §11
 * 2026-10-16). The kinds and their texts were closed with marketing
 * (docs/marketing/oferta-y-promociones.md D1–D15). Money is integer cents in the currency of the
 * distributor. Everything but the title and the end is fixed once saved: a different price,
 * product or cap is another promotion, so the history tells the truth.
 */
export const PROMOTION_TYPES = ['fixedPrice', 'percentOff', 'amountOff', 'buyXPayY'] as const;
export type PromotionType = (typeof PROMOTION_TYPES)[number];

/** Where the price of a `fixedPrice` comes from: its own amount, or the refill price of today. */
export const PRICE_SOURCES = ['own', 'refill'] as const;
export type PriceSource = (typeof PRICE_SOURCES)[number];

/** What the promotion gives, with the parameters of its type. */
export type PromotionDeal =
  /** P1 and P4: a special price for one product. */
  | { type: 'fixedPrice'; priceSource: 'own'; priceCents: number }
  /** P3, "balón completo al precio del gas": the full cylinder at the refill price of today. */
  | { type: 'fixedPrice'; priceSource: 'refill' }
  /** P2: a percentage off every unit, at most 30 %. */
  | { type: 'percentOff'; percent: number }
  /** "S/ 5 menos" on every unit (D9). */
  | { type: 'amountOff'; amountCents: number }
  /** P5: "lleva 2, paga 1" or "lleva 3, paga 2", same product and same way of selling. */
  | { type: 'buyXPayY'; buyUnits: number; payUnits: number };

/** What the owner decides when it adds a promotion. */
export interface PromotionTerms {
  title: string;
  deal: PromotionDeal;
  /** Product slots it applies to; "Todos" is the whole list of today, not a wildcard. */
  productIds: string[];
  /** One way of selling: "Solo recarga" or "Solo balón completo" (marketing §3.1). */
  saleMode: SaleMode;
  startsAt: Date;
  endsAt: Date;
  /** Units of a whole order (not of a line) that may take it. */
  maxUnitsPerOrder: number;
  /** Total cap of units, or null for none (required for P3 and P5, D15). */
  totalUnits: number | null;
  /** What the customer must know; shown whole, never behind a "ver más" (H4). */
  conditions: string;
  /** False for one saved without publishing (or switched off). */
  active: boolean;
}

export interface Promotion extends PromotionTerms {
  /** Slot, `o00` … `o19`. */
  id: string;
  /** Units sold with it; raised by the order that takes it (phase 4), never by the staff. */
  soldUnits: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  /** Who switched it off before its end, and when; null while it was not. */
  switchedOffBy: string | null;
  switchedOffAt: Date | null;
}

/**
 * A promotion as the repository writes it. `startsAt: 'now'` takes the time of the server (the
 * rules accept no start in the past).
 */
export type NewPromotion = Omit<PromotionTerms, 'startsAt'> & { startsAt: Date | 'now' };

const SLOT_DIGITS = 2;

/** `o00` … `o19` (firebase/firestore.rules: `^o[0-1][0-9]$`). */
export const PROMOTION_SLOT_IDS: readonly string[] = Array.from(
  { length: MAX_PROMOTIONS },
  (_, index) => `o${String(index).padStart(SLOT_DIGITS, '0')}`,
);

/**
 * Where a promotion stands for its list (marketing §4): `draft` saved without publishing,
 * `scheduled` published but not started, `live` applies now, `soldOut` reached its total cap,
 * `ended` past its end, `switchedOff` turned off by the owner.
 */
export type PromotionState = 'draft' | 'scheduled' | 'live' | 'soldOut' | 'ended' | 'switchedOff';

type StateFields = Pick<
  Promotion,
  'active' | 'startsAt' | 'endsAt' | 'totalUnits' | 'soldUnits' | 'switchedOffAt'
>;

export function promotionStateOf(promotion: StateFields, now: Date): PromotionState {
  if (promotion.switchedOffAt !== null) return 'switchedOff';
  if (promotion.endsAt.getTime() <= now.getTime()) return 'ended';
  if (!promotion.active) return 'draft';
  if (promotion.startsAt.getTime() > now.getTime()) return 'scheduled';
  return remainingUnits(promotion) === 0 ? 'soldOut' : 'live';
}

/** Vigente (glp-domain §5b): published, started, not ended and with units left. */
export function isLive(promotion: StateFields, now: Date): boolean {
  return promotionStateOf(promotion, now) === 'live';
}

/** Units left under the total cap ("Quedan N"); null when there is no cap. */
export function remainingUnits(
  promotion: Pick<Promotion, 'totalUnits' | 'soldUnits'>,
): number | null {
  if (promotion.totalUnits === null) return null;
  return Math.max(0, promotion.totalUnits - promotion.soldUnits);
}

/**
 * The slot a new promotion takes: a free one, or else the one whose promotion ended or was
 * switched off the longest ago. Never one saved without publishing that has not ended (that
 * would lose the owner's draft). Null when all 20 are alive.
 */
export function freePromotionSlot(promotions: readonly Promotion[], now: Date): string | null {
  const used = new Map(promotions.map((promotion) => [promotion.id, promotion]));
  const free = PROMOTION_SLOT_IDS.find((slot) => !used.has(slot));
  if (free !== undefined) return free;
  const over = promotions
    .filter((promotion) => ['ended', 'switchedOff'].includes(promotionStateOf(promotion, now)))
    .map((promotion) => ({ id: promotion.id, at: overAt(promotion).getTime() }))
    .sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
  return over[0]?.id ?? null;
}

function overAt(promotion: Pick<Promotion, 'switchedOffAt' | 'endsAt'>): Date {
  return promotion.switchedOffAt ?? promotion.endsAt;
}

const CENTS_PER_UNIT = 100;

/** "−S/ 5" for whole soles, "−S/ 5.50" otherwise. */
function amountBadge(amountCents: number, currency: string): string {
  const money = formatMoney(amountCents, currency);
  return `−${amountCents % CENTS_PER_UNIT === 0 ? money.slice(0, -'.00'.length) : money}`;
}

/**
 * The seal of the card (marketing §3.1, H11): the system sets it from the kind, the owner never
 * writes it. "Oferta", "−S/ 5", "2×1", "3×2" or "Con envase al precio del gas".
 */
export function promotionBadge(deal: PromotionDeal, currency = 'PEN'): string {
  switch (deal.type) {
    case 'fixedPrice':
      return deal.priceSource === 'refill' ? 'Con envase al precio del gas' : 'Oferta';
    case 'amountOff':
      return amountBadge(deal.amountCents, currency);
    case 'buyXPayY':
      return `${deal.buyUnits}×${deal.payUnits}`;
    case 'percentOff':
      return 'Oferta';
  }
}
