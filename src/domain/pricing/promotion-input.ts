import { MAX_PRODUCTS } from '../catalog/constants';
import type { Product } from '../catalog/product';
import {
  type Check,
  checkVisibleText,
  type FieldIssue,
  type Validated,
} from '../tenancy/field-checks';
import { checkConditions } from './conditions';
import {
  MAX_PROMOTION_DAYS,
  MAX_SCHEDULE_AHEAD_DAYS,
  PROMOTION_TITLE_MAX_LENGTH,
} from './constants';
import { dealIssues, unitIssues } from './deal-checks';
import { listPriceOf } from './discount';
import type { NewPromotion, PromotionDeal } from './promotion';

/** The form of "Añadir promoción", as chosen (prices already in integer cents). */
export type PromotionInput = Omit<NewPromotion, 'conditions' | 'active'> & {
  conditions?: string;
  /** "Publicar promoción" (true, the default) or "Guardar sin publicar" (false). */
  active?: boolean;
};

const MS_PER_DAY = 86_400_000;
const SPACES = /\s+/g;
const tidy = (text: string) => text.trim().replace(SPACES, ' ');
const issue = (field: string, code: Check): FieldIssue[] => (code ? [{ field, code }] : []);

/** The products the promotion names, as long as each one is on sale that way. */
function checkProducts(input: PromotionInput, catalog: readonly Product[]): FieldIssue[] {
  const ids = input.productIds;
  if (ids.length === 0) return issue('productIds', 'required');
  if (new Set(ids).size !== ids.length || ids.length > MAX_PRODUCTS) {
    return issue('productIds', 'invalid');
  }
  if (input.deal.type === 'fixedPrice' && ids.length !== 1)
    return issue('productIds', 'outOfRange');
  const chosen = ids.map((id) => catalog.find((product) => product.id === id));
  if (chosen.some((product) => !product?.active)) return issue('productIds', 'unavailable');
  const sold = chosen.every((product) => product && listPriceOf(product, input.saleMode) !== null);
  return issue('saleMode', sold ? null : 'unavailable');
}

/**
 * Starts now (the server time) or later, up to 30 days ahead; ends after it starts and at most
 * 30 days later (D6). Same checks as `isValidWindow()` in firebase/firestore.rules.
 */
export function windowIssues(startsAt: Date | 'now', endsAt: Date, now: Date): FieldIssue[] {
  const start = startsAt === 'now' ? now : startsAt;
  const ahead = start.getTime() - now.getTime();
  if (ahead < 0 || ahead > MAX_SCHEDULE_AHEAD_DAYS * MS_PER_DAY) {
    return issue('startsAt', 'outOfRange');
  }
  const length = endsAt.getTime() - start.getTime();
  if (length <= 0) return issue('endsAt', 'notAbove');
  return issue('endsAt', length > MAX_PROMOTION_DAYS * MS_PER_DAY ? 'outOfRange' : null);
}

function chosenProducts(ids: readonly string[], catalog: readonly Product[]): Product[] {
  return catalog.filter((product) => ids.includes(product.id));
}

function issuesOf(value: NewPromotion, catalog: readonly Product[], now: Date): FieldIssue[] {
  const products = checkProducts(value, catalog);
  return [
    ...issue('title', checkVisibleText(value.title, 1, PROMOTION_TITLE_MAX_LENGTH)),
    ...issue('conditions', checkConditions(value.conditions)),
    ...products,
    ...(products.length > 0
      ? []
      : dealIssues(value.deal, chosenProducts(value.productIds, catalog), value.saleMode)),
    ...unitIssues(value.deal, value.maxUnitsPerOrder, value.totalUnits),
    ...windowIssues(value.startsAt, value.endsAt, now),
  ];
}

/** Copies the parameters of the kind and nothing else (the rules accept no other field). */
function tidyDeal(deal: PromotionDeal): PromotionDeal {
  switch (deal.type) {
    case 'fixedPrice':
      return deal.priceSource === 'refill'
        ? { type: 'fixedPrice', priceSource: 'refill' }
        : { type: 'fixedPrice', priceSource: 'own', priceCents: deal.priceCents };
    case 'percentOff':
      return { type: 'percentOff', percent: deal.percent };
    case 'amountOff':
      return { type: 'amountOff', amountCents: deal.amountCents };
    case 'buyXPayY':
      return { type: 'buyXPayY', buyUnits: deal.buyUnits, payUnits: deal.payUnits };
  }
}

/**
 * Normalises and validates a new promotion against the catalogue as the owner sees it at `now`
 * (PLAN 3.5). `catalog` is the whole catalogue of the distributor.
 */
export function preparePromotion(
  input: PromotionInput,
  catalog: readonly Product[],
  now: Date,
): Validated<NewPromotion> {
  const value: NewPromotion = {
    title: tidy(input.title),
    deal: tidyDeal(input.deal),
    productIds: [...input.productIds],
    saleMode: input.saleMode,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    maxUnitsPerOrder: input.maxUnitsPerOrder,
    totalUnits: input.totalUnits,
    conditions: tidy(input.conditions ?? ''),
    active: input.active ?? true,
  };
  const issues = issuesOf(value, catalog, now);
  return issues.length > 0 ? { ok: false, issues } : { ok: true, value };
}
