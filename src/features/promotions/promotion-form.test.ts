import { describe, expect, it } from 'vitest';
import { CATALOG, NOW, promotion } from '../../../tests/support/pricing-fixtures';
import { InvalidInputError } from '../../domain/tenancy/errors';
import {
  dayInputOf,
  formFromPromotion,
  promotionFormErrorsOf,
  readPromotionForm,
  windowOf,
} from './promotion-form';
import { formForTemplate, templateTitle } from './promotion-templates';

const LIMA = 'America/Lima';
const SETTINGS = { timeZone: LIMA, opensAt: '07:00', closesAt: '20:00' };
const TODAY = { today: dayInputOf(NOW, LIMA) };

// PLAN 3.5: the form of "Añadir promoción" (marketing §4) and what it hands to the domain.
describe('promotion form', () => {
  it('starts "S/ menos" at S/ 5, 7 days and 2 per order on the first product', () => {
    const form = formForTemplate('amountOff', CATALOG, TODAY);

    expect(form).toMatchObject({
      productIds: ['p00'],
      saleMode: 'refill',
      amount: '5',
      validity: 'days7',
      maxUnitsPerOrder: 2,
      title: 'S/ 5 menos',
    });
  });

  it('fixes "al precio del gas" to the full cylinder, 1 per order and a total cap', () => {
    const form = formForTemplate('fullAtRefill', CATALOG, TODAY);

    expect(form).toMatchObject({ saleMode: 'full', maxUnitsPerOrder: 1, hasTotalCap: true });
  });

  it('names the template with its number until the owner types a name', () => {
    expect(templateTitle({ ...formForTemplate('percentOff', CATALOG, TODAY), percent: '15' })).toBe(
      '15 % menos',
    );
  });

  it('reads the soles and the window, and publishes unless told otherwise', () => {
    const form = { ...formForTemplate('specialPrice', CATALOG, TODAY), price: '48' };
    const read = readPromotionForm(form, NOW, SETTINGS, true);

    expect(read).toMatchObject({
      ok: true,
      input: {
        deal: { type: 'fixedPrice', priceSource: 'own', priceCents: 4800 },
        startsAt: 'now',
        active: true,
      },
    });
  });

  it('ends "Solo hoy" at the closing time of the distributor', () => {
    const window = windowOf(
      { ...formForTemplate('specialPrice', CATALOG, TODAY), validity: 'today' },
      NOW,
      SETTINGS,
    );

    expect(window?.endsAt.toISOString()).toBe('2026-10-17T01:00:00.000Z');
  });

  it('asks for the end day when the dates are chosen by hand', () => {
    const form = {
      ...formForTemplate('specialPrice', CATALOG, TODAY),
      validity: 'dates' as const,
      endDay: '',
    };

    expect(readPromotionForm(form, NOW, SETTINGS, true)).toEqual({
      ok: false,
      errors: { validity: 'Elige el día en que termina.' },
    });
  });

  it('refuses a total cap that is not a whole number', () => {
    const form = { ...formForTemplate('buyXPayY', CATALOG, TODAY), totalUnits: 'diez' };
    const read = readPromotionForm(form, NOW, SETTINGS, true);

    expect(read.ok).toBe(false);
  });

  it('puts the blocked phrase of the conditions on its field', () => {
    const error = new InvalidInputError([{ field: 'conditions', code: 'blockedPhrase' }]);

    expect(promotionFormErrorsOf(error).conditions).toMatch(/Hornilla no cuenta unidades/);
  });

  it('repeats a promotion with its terms and the name it had', () => {
    const form = formFromPromotion(promotion({ title: 'Semana del gas' }), TODAY);

    expect(form).toMatchObject({
      template: 'specialPrice',
      productIds: ['p00'],
      price: '48.00',
      title: 'Semana del gas',
      isTitleTyped: true,
    });
  });
});
