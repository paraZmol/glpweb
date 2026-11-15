import { useState } from 'react';
import type { Product } from '@/domain/catalog/product';
import { parseMoneyCents } from '@/domain/money/parse';
import { MAX_SCHEDULE_AHEAD_DAYS } from '@/domain/pricing/constants';
import { previewPromotion } from '@/domain/pricing/preview';
import type { Promotion } from '@/domain/pricing/promotion';
import { describeValidity } from '@/domain/pricing/validity';
import { DEFAULT_TIMEZONE } from '@/domain/tenancy/constants';
import type { Distributor } from '@/domain/tenancy/types';
import {
  dayInputOf,
  formFromPromotion,
  type PromotionFormErrors,
  type PromotionSettings,
  windowOf,
} from '@/features/promotions/promotion-form';
import {
  dealOf,
  eligibleProducts,
  formForTemplate,
  type PromotionForm,
  type PromotionTemplate,
  templateTitle,
} from '@/features/promotions/promotion-templates';

const MS_PER_DAY = 86_400_000;

/** Which error each field clears when it changes. */
const CLEARS: Partial<Record<keyof PromotionForm, keyof PromotionFormErrors>> = {
  productIds: 'productIds',
  saleMode: 'saleMode',
  price: 'deal',
  amount: 'deal',
  percent: 'deal',
  buyUnits: 'deal',
  validity: 'validity',
  fromTime: 'validity',
  toTime: 'validity',
  startDay: 'validity',
  endDay: 'validity',
  maxUnitsPerOrder: 'maxUnitsPerOrder',
  totalUnits: 'totalUnits',
  hasTotalCap: 'totalUnits',
  title: 'title',
  conditions: 'conditions',
};

/**
 * The state of "Añadir promoción" (marketing §4): the template, the typed fields and what they
 * mean right now — the window, the deal, the products and the preview of what stops being
 * charged. The name follows the template until the owner types one.
 */
export function usePromotionForm(
  distributor: Distributor,
  catalog: readonly Product[],
  repeat: Promotion | null,
) {
  // The moment the form opened: windows and texts are read against it (saving reads the clock).
  const [now] = useState(() => new Date());
  const timeZone = DEFAULT_TIMEZONE;
  const today = dayInputOf(now, timeZone);
  const lastDay = dayInputOf(
    new Date(now.getTime() + MAX_SCHEDULE_AHEAD_DAYS * MS_PER_DAY),
    timeZone,
  );
  const settings: PromotionSettings = {
    timeZone,
    closesAt: distributor.schedule.closesAt,
    opensAt: distributor.schedule.opensAt,
  };
  const [form, setForm] = useState<PromotionForm | null>(() =>
    repeat ? formFromPromotion(repeat, { today }) : null,
  );
  const [errors, setErrors] = useState<PromotionFormErrors>({});

  const choose = (template: PromotionTemplate | null) => {
    setForm(template && formForTemplate(template, catalog, { today }));
    setErrors({});
  };

  const set = (patch: Partial<PromotionForm>) => {
    setForm((current) => {
      if (!current) return current;
      const next = { ...current, ...patch };
      if (patch.title !== undefined) next.isTitleTyped = true;
      else if (!next.isTitleTyped) next.title = templateTitle(next);
      if (patch.saleMode) {
        const allowed = new Set(
          eligibleProducts(catalog, patch.saleMode).map((product) => product.id),
        );
        next.productIds = next.productIds.filter((id) => allowed.has(id));
      }
      return next;
    });
    const cleared = new Set(
      Object.keys(patch).map((field) => CLEARS[field as keyof PromotionForm]),
    );
    setErrors((current) =>
      Object.fromEntries(
        Object.entries(current).filter(
          ([field]) => field !== 'form' && !cleared.has(field as keyof PromotionFormErrors),
        ),
      ),
    );
  };

  const window = form && windowOf(form, now, settings);
  const deal = form && dealOf(form, parseMoneyCents);
  const chosen = form ? catalog.filter((product) => form.productIds.includes(product.id)) : [];
  const preview = form && deal ? previewPromotion(deal, chosen, form.saleMode) : null;
  const validity =
    window &&
    describeValidity(
      { startsAt: window.startsAt === 'now' ? now : window.startsAt, endsAt: window.endsAt },
      now,
      timeZone,
    );

  return {
    form,
    errors,
    setErrors,
    choose,
    set,
    now,
    settings,
    limits: { today, lastDay },
    window,
    deal,
    chosen,
    preview,
    validity,
    eligible: form ? eligibleProducts(catalog, form.saleMode) : [],
  };
}

export type PromotionFormState = ReturnType<typeof usePromotionForm>;
