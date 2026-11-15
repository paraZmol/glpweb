import { MAX_TOTAL_UNITS } from '../../domain/pricing/constants';
import type { PromotionInput } from '../../domain/pricing/promotion-input';
import {
  instantAt,
  type LocalSettings,
  localDayOf,
  promotionWindow,
  type ValidityPreset,
  type ValidityWindow,
} from '../../domain/pricing/validity';
import { parseMoneyCents } from '../../domain/money/parse';
import { InvalidInputError } from '../../domain/tenancy/errors';
import { describePromotionError, describePromotionIssue } from './promotion-messages';
import type { Promotion } from '../../domain/pricing/promotion';
import { centsToInput } from '../catalog/product-form';
import {
  DEFAULT_AMOUNT,
  DEFAULT_PERCENT,
  dealOf,
  formForTemplate,
  type PromotionForm,
  type PromotionTemplate,
  THREE_FOR_TWO,
  type ValidityChoice,
} from './promotion-templates';

export type PromotionFormField =
  | 'productIds'
  | 'saleMode'
  | 'deal'
  | 'validity'
  | 'maxUnitsPerOrder'
  | 'totalUnits'
  | 'title'
  | 'conditions';
export type PromotionFormErrors = Partial<Record<PromotionFormField | 'form', string>>;

/** Settings of the distributor the dates are read in (PLAN §11, 2026-10-16). */
export type PromotionSettings = LocalSettings & { opensAt: string };

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
const WHOLE = /^\d+$/;
const PRICE_FORMAT = 'Escribe el monto en soles, por ejemplo 48.00.';
const PERCENT_FORMAT = 'Escribe el porcentaje en números enteros, por ejemplo 10.';
const TOTAL_FORMAT = `Escribe el tope total en números enteros, de 1 a ${MAX_TOTAL_UNITS}.`;
const PAST_WINDOW = 'Esa vigencia ya pasó hoy. Elige otra.';
const DATES_MISSING = 'Elige el día en que termina.';

/** Domain field → form field. */
const FORM_FIELD: Record<string, PromotionFormField> = {
  productIds: 'productIds',
  saleMode: 'saleMode',
  priceCents: 'deal',
  amountCents: 'deal',
  percent: 'deal',
  buyUnits: 'deal',
  startsAt: 'validity',
  endsAt: 'validity',
  maxUnitsPerOrder: 'maxUnitsPerOrder',
  totalUnits: 'totalUnits',
  title: 'title',
  conditions: 'conditions',
};

/** "2026-10-18" for a local day, as a date field writes it. */
export function dayInputOf(instant: Date, timeZone: string): string {
  const { year, month, day } = localDayOf(instant, timeZone);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function dayOf(text: string) {
  const match = DAY.exec(text);
  return match ? { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) } : null;
}

const PRESETS: Partial<Record<ValidityChoice, ValidityPreset>> = {
  today: { kind: 'today' },
  weekend: { kind: 'weekend' },
  days7: { kind: 'days', days: 7 },
  days15: { kind: 'days', days: 15 },
  days30: { kind: 'days', days: 30 },
};

/** The window the chosen validity means at `now`; null when it is over or incomplete. */
export function windowOf(
  form: PromotionForm,
  now: Date,
  settings: PromotionSettings,
): ValidityWindow | null {
  const preset = PRESETS[form.validity];
  if (preset) return promotionWindow(preset, now, settings);
  if (form.validity === 'todayHours') {
    return promotionWindow(
      { kind: 'todayHours', from: form.fromTime, to: form.toTime },
      now,
      settings,
    );
  }
  const start = dayOf(form.startDay);
  const end = dayOf(form.endDay);
  if (!start || !end) return null;
  const isToday = form.startDay === dayInputOf(now, settings.timeZone);
  const startsAt = isToday ? 'now' : instantAt(start, settings.opensAt, settings.timeZone);
  const endsAt = instantAt(end, settings.closesAt, settings.timeZone);
  return endsAt.getTime() > now.getTime() ? { startsAt, endsAt } : null;
}

export type ReadPromotionForm =
  { ok: true; input: PromotionInput } | { ok: false; errors: PromotionFormErrors };

function totalOf(form: PromotionForm): number | null | undefined {
  if (!form.hasTotalCap) return null;
  const text = form.totalUnits.trim();
  return WHOLE.test(text) ? Number(text) : undefined;
}

/**
 * The typed form as a promotion: only formats are read here (amounts, dates); every limit is
 * the domain's (`addPromotion` validates against the catalogue, `promotionFormErrorsOf` paints it).
 */
export function readPromotionForm(
  form: PromotionForm,
  now: Date,
  settings: PromotionSettings,
  publish: boolean,
): ReadPromotionForm {
  const errors: PromotionFormErrors = {};
  const deal = dealOf(form, parseMoneyCents);
  if (!deal) errors.deal = form.template === 'percentOff' ? PERCENT_FORMAT : PRICE_FORMAT;
  const window = windowOf(form, now, settings);
  if (!window)
    errors.validity =
      form.validity === 'dates' && !dayOf(form.endDay) ? DATES_MISSING : PAST_WINDOW;
  const totalUnits = totalOf(form);
  if (totalUnits === undefined) errors.totalUnits = TOTAL_FORMAT;
  if (!deal || !window || totalUnits === undefined) return { ok: false, errors };
  return {
    ok: true,
    input: {
      title: form.title,
      deal,
      productIds: form.productIds,
      saleMode: form.saleMode,
      startsAt: window.startsAt,
      endsAt: window.endsAt,
      maxUnitsPerOrder: form.maxUnitsPerOrder,
      totalUnits,
      conditions: form.conditions,
      active: publish,
    },
  };
}

/** Whatever saving threw, as messages on the fields (or on the whole form). */
export function promotionFormErrorsOf(error: unknown): PromotionFormErrors {
  if (!(error instanceof InvalidInputError)) return { form: describePromotionError(error) };
  const errors: PromotionFormErrors = {};
  for (const issue of error.issues) {
    const field = FORM_FIELD[issue.field] ?? 'form';
    errors[field] ??= describePromotionIssue(issue);
  }
  return errors;
}

/** "Repetir" (marketing §4): the same terms in a new form, with new dates. */
export function formFromPromotion(promotion: Promotion, days: { today: string }): PromotionForm {
  const { deal } = promotion;
  const template: PromotionTemplate =
    deal.type === 'fixedPrice'
      ? deal.priceSource === 'refill'
        ? 'fullAtRefill'
        : promotion.saleMode === 'full'
          ? 'fullDiscount'
          : 'specialPrice'
      : deal.type;
  return {
    ...formForTemplate(template, [], days),
    productIds: [...promotion.productIds],
    saleMode: promotion.saleMode,
    price:
      deal.type === 'fixedPrice' && deal.priceSource === 'own' ? centsToInput(deal.priceCents) : '',
    amount:
      deal.type === 'amountOff'
        ? centsToInput(deal.amountCents).replace(/\.00$/, '')
        : DEFAULT_AMOUNT,
    percent: deal.type === 'percentOff' ? String(deal.percent) : DEFAULT_PERCENT,
    buyUnits: deal.type === 'buyXPayY' ? deal.buyUnits : THREE_FOR_TWO.buyUnits,
    payUnits: deal.type === 'buyXPayY' ? deal.payUnits : THREE_FOR_TWO.payUnits,
    maxUnitsPerOrder: promotion.maxUnitsPerOrder,
    hasTotalCap: promotion.totalUnits !== null,
    totalUnits: promotion.totalUnits === null ? '' : String(promotion.totalUnits),
    title: promotion.title,
    isTitleTyped: true,
    conditions: promotion.conditions,
  };
}
