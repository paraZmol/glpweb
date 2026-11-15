import { describe, expect, it } from 'vitest';
import { InvalidInputError } from '../../domain/tenancy/errors';
import { NegativeStockError } from '../../domain/stock/errors';
import { readStockForm, stockFormErrorsOf, stockFormFor } from './stock-form';

const STOCK = { productId: 'p00', full: 40, empty: 12, lastMovementId: 'm1', updatedAt: null };

// PLAN 3.4: what the two numbers of the adjustment mean for each reason.
describe('readStockForm', () => {
  it('turns a physical count into the difference with the stock', () => {
    const form = { ...stockFormFor('count', STOCK), full: '43', empty: '10' };

    expect(readStockForm(form, STOCK)).toEqual({
      ok: true,
      change: { fullDelta: 3, emptyDelta: -2 },
      counted: { full: 43, empty: 10 },
    });
  });

  it('starts a count at what the stock says, so an untouched count changes nothing', () => {
    const read = readStockForm(stockFormFor('count', STOCK), STOCK);

    expect(read).toMatchObject({ ok: true, change: { fullDelta: 0, emptyDelta: 0 } });
  });

  it('adds the full ones that arrived and takes away the empty ones the supplier took', () => {
    const form = { ...stockFormFor('supplier', STOCK), full: '20', empty: '15' };

    expect(readStockForm(form, STOCK)).toMatchObject({
      change: { fullDelta: 20, emptyDelta: -15 },
      counted: null,
    });
  });

  it('takes damaged cylinders out of the stock, a blank side being zero', () => {
    const form = { ...stockFormFor('damaged', STOCK), full: '2' };

    expect(readStockForm(form, STOCK)).toMatchObject({ change: { fullDelta: -2, emptyDelta: 0 } });
  });

  it('reads the sign of "other", with any kind of minus', () => {
    const form = { ...stockFormFor('other', STOCK), full: '−2', empty: '+3' };

    expect(readStockForm(form, STOCK)).toMatchObject({ change: { fullDelta: -2, emptyDelta: 3 } });
  });

  it('refuses a number with a sign where only a count makes sense', () => {
    const read = readStockForm({ ...stockFormFor('supplier', STOCK), full: '-3' }, STOCK);

    expect(read).toEqual({
      ok: false,
      errors: { full: 'Escribe un número entero de balones, por ejemplo 3.' },
    });
  });

  it('refuses a blank count', () => {
    const read = readStockForm({ ...stockFormFor('count', STOCK), empty: ' ' }, STOCK);

    expect(read.ok).toBe(false);
  });
});

describe('stockFormErrorsOf', () => {
  it('puts the refusals of the domain on the fields of the form', () => {
    const error = new InvalidInputError([{ field: 'note', code: 'required' }]);

    expect(stockFormErrorsOf(error)).toEqual({
      note: 'Cuenta en una nota por qué ajustas el stock.',
    });
  });

  it('says a stock below zero on the whole form', () => {
    expect(stockFormErrorsOf(new NegativeStockError({ full: -1, empty: 0 }))).toEqual({
      form: 'Con ese ajuste el stock quedaría por debajo de cero. Revisa las cantidades.',
    });
  });
});
