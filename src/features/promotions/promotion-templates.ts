import type { Product } from '../../domain/catalog/product';
import type { SaleMode } from '../../domain/catalog/sale-mode';
import { BUY_X_PAY_Y_OPTIONS } from '../../domain/pricing/constants';
import type { PromotionDeal } from '../../domain/pricing/promotion';
import { centsToInput } from '../catalog/product-form';

// The six templates of "Añadir promoción" (docs/marketing/oferta-y-promociones.md §4, step 1).
// The owner picks one; the kind, the seal and the fixed parts come from it (H11).
export const PROMOTION_TEMPLATES = [
  'specialPrice',
  'amountOff',
  'percentOff',
  'fullAtRefill',
  'fullDiscount',
  'buyXPayY',
] as const;
export type PromotionTemplate = (typeof PROMOTION_TEMPLATES)[number];

export type ValidityChoice =
  'today' | 'weekend' | 'days7' | 'days15' | 'days30' | 'dates' | 'todayHours';

/** The form of "Añadir promoción" as typed: amounts are the texts of their fields. */
export interface PromotionForm {
  template: PromotionTemplate;
  productIds: string[];
  saleMode: SaleMode;
  /** Soles as typed ("48", "48.50"): the special price, or the soles off. */
  price: string;
  amount: string;
  percent: string;
  buyUnits: number;
  payUnits: number;
  validity: ValidityChoice;
  /** 'HH:MM' of today, for "Solo hoy, por horas". */
  fromTime: string;
  toTime: string;
  /** 'YYYY-MM-DD' in the time of the distributor, for "Elegir fechas". */
  startDay: string;
  endDay: string;
  maxUnitsPerOrder: number;
  hasTotalCap: boolean;
  totalUnits: string;
  title: string;
  /** The owner wrote its own name: the template no longer renames it. */
  isTitleTyped: boolean;
  conditions: string;
  /** "Entiendo y quiero publicarla", for the risky ones (marketing §4, step 3). */
  acceptsRisk: boolean;
}

/** The templates whose way of selling is fixed; the others start with the refill. */
export const FIXED_SALE_MODE: Partial<Record<PromotionTemplate, SaleMode>> = {
  fullAtRefill: 'full',
  fullDiscount: 'full',
};

/** One product only: a special price is the price of one product (PLAN §11, 2026-10-16). */
export const isSingleProduct = (template: PromotionTemplate) =>
  template === 'specialPrice' || template === 'fullAtRefill' || template === 'fullDiscount';

const SOL = 100;
const SPECIAL_PRICE_OFF_CENTS = 4 * SOL;
const FULL_DISCOUNT_OFF_CENTS = 10 * SOL;
export const DEFAULT_AMOUNT = '5';
export const DEFAULT_PERCENT = '10';
const DEFAULT_MAX_PER_ORDER = 2;
const [TWO_FOR_ONE, THREE_FOR_TWO] = BUY_X_PAY_Y_OPTIONS;
export { THREE_FOR_TWO, TWO_FOR_ONE };

/** Products the promotion may name sold that way: on sale, with that price. */
export function eligibleProducts(catalog: readonly Product[], saleMode: SaleMode): Product[] {
  return catalog.filter(
    (product) => product.active && (saleMode === 'refill' || product.fullPriceCents !== null),
  );
}

/** The kind the form describes, read from its texts; null while a number is unreadable. */
export function dealOf(
  form: PromotionForm,
  read: (text: string) => number | null,
): PromotionDeal | null {
  switch (form.template) {
    case 'specialPrice':
    case 'fullDiscount': {
      const priceCents = read(form.price);
      return priceCents === null ? null : { type: 'fixedPrice', priceSource: 'own', priceCents };
    }
    case 'fullAtRefill':
      return { type: 'fixedPrice', priceSource: 'refill' };
    case 'amountOff': {
      const amountCents = read(form.amount);
      return amountCents === null ? null : { type: 'amountOff', amountCents };
    }
    case 'percentOff': {
      const percent = Number(form.percent.trim());
      return Number.isInteger(percent) && form.percent.trim() !== ''
        ? { type: 'percentOff', percent }
        : null;
    }
    case 'buyXPayY':
      return { type: 'buyXPayY', buyUnits: form.buyUnits, payUnits: form.payUnits };
  }
}

/** The name a template gives, updated with its number until the owner types one. */
export function templateTitle(
  form: Pick<PromotionForm, 'template' | 'amount' | 'percent' | 'buyUnits' | 'payUnits'>,
): string {
  switch (form.template) {
    case 'specialPrice':
      return 'Precio especial';
    case 'amountOff':
      return `S/ ${form.amount.trim() || DEFAULT_AMOUNT} menos`;
    case 'percentOff':
      return `${form.percent.trim() || DEFAULT_PERCENT} % menos`;
    case 'fullAtRefill':
      return 'Envase al precio del gas';
    case 'fullDiscount':
      return 'Balón completo con rebaja';
    case 'buyXPayY':
      return `Lleva ${form.buyUnits}, paga ${form.payUnits}`;
  }
}

/** The price a template suggests for a product: its list price minus a few soles, never ≤ 0. */
export function suggestedPrice(template: PromotionTemplate, product: Product | undefined): string {
  if (!product) return '';
  const isFull = template === 'fullDiscount';
  const list = isFull
    ? (product.fullPriceCents ?? product.refillPriceCents)
    : product.refillPriceCents;
  const off = isFull ? FULL_DISCOUNT_OFF_CENTS : SPECIAL_PRICE_OFF_CENTS;
  return centsToInput(list > off ? list - off : list - 1);
}

/** The first values of a template (marketing §4, step 2), on the first product it may name. */
export function formForTemplate(
  template: PromotionTemplate,
  catalog: readonly Product[],
  days: { today: string },
): PromotionForm {
  const saleMode = FIXED_SALE_MODE[template] ?? 'refill';
  const first = eligibleProducts(catalog, saleMode)[0];
  const isBuy = template === 'buyXPayY';
  const base = {
    template,
    amount: DEFAULT_AMOUNT,
    percent: DEFAULT_PERCENT,
    buyUnits: THREE_FOR_TWO.buyUnits,
    payUnits: THREE_FOR_TWO.payUnits,
  };
  // "Al precio del gas" and "lleva X, paga Y" need a total cap and suit a short window (D5, D15).
  const isRisky = template === 'fullAtRefill' || isBuy;
  const isFull = FIXED_SALE_MODE[template] === 'full';
  return {
    ...base,
    productIds: first ? [first.id] : [],
    saleMode,
    price: suggestedPrice(template, first),
    validity: isRisky ? 'weekend' : 'days7',
    fromTime: '14:00',
    toTime: '17:00',
    startDay: days.today,
    endDay: days.today,
    maxUnitsPerOrder: isBuy ? THREE_FOR_TWO.buyUnits : isFull ? 1 : DEFAULT_MAX_PER_ORDER,
    hasTotalCap: isRisky,
    totalUnits: '',
    title: templateTitle(base),
    isTitleTyped: false,
    conditions: '',
    acceptsRisk: false,
  };
}
