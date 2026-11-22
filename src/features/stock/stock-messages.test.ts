import { describe, expect, it } from 'vitest';
import { NegativeStockError, StockChangedError } from '../../domain/stock/errors';
import { prepareAdjustment } from '../../domain/stock/movement';
import { InvalidInputError, NothingChangedError } from '../../domain/tenancy/errors';
import { recordStockCount } from './stock-actions';
import { adjustmentFieldMessagesOf, describeStockError } from './stock-messages';

describe('stock messages', () => {
  it('asks for a note when the reason is "other"', () => {
    const prepared = prepareAdjustment({
      productId: 'p00',
      reason: 'other',
      fullDelta: 1,
      emptyDelta: 0,
    });
    const error = new InvalidInputError(prepared.ok ? [] : prepared.issues);
    expect(adjustmentFieldMessagesOf(error)).toEqual({
      note: 'Cuenta en una nota por qué ajustas el stock.',
    });
  });

  it('explains a stock that would go below zero', () => {
    expect(describeStockError(new NegativeStockError({ full: -1, empty: 0 }))).toBe(
      'Con ese ajuste el stock quedaría por debajo de cero. Revisa las cantidades.',
    );
  });

  it('says what the stock holds now when it changed during a count', () => {
    const error = new StockChangedError({ full: 1, empty: 12, lastMovementId: 'm2' });

    expect(describeStockError(error)).toBe(
      'El stock cambió mientras contabas: ahora figuran 1 lleno y 12 vacíos. Revisa tu conteo y vuelve a guardar.',
    );
  });
});

describe('recordStockCount', () => {
  it('writes nothing when the count matches the stock', async () => {
    const current = { productId: 'p00', full: 7, empty: 1, lastMovementId: null, updatedAt: null };

    await expect(
      recordStockCount('d', 'owner', { current, counted: { full: 7, empty: 1 } }),
    ).rejects.toBeInstanceOf(NothingChangedError);
  });
});
