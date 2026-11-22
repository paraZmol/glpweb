import { describe, expect, it } from 'vitest';
import { ADJUSTMENT_NOTE_MAX_LENGTH, MAX_ADJUSTMENT_UNITS } from './constants';
import { type AdjustmentInput, prepareAdjustment } from './movement';

const input = (change: Partial<AdjustmentInput> = {}): AdjustmentInput => ({
  productId: 'p00',
  reason: 'supplier',
  fullDelta: 20,
  emptyDelta: -20,
  ...change,
});

describe('prepareAdjustment', () => {
  it('keeps a supplier exchange without a note', () => {
    expect(prepareAdjustment(input())).toEqual({
      ok: true,
      value: { productId: 'p00', reason: 'supplier', note: null, fullDelta: 20, emptyDelta: -20 },
    });
  });

  it('tidies the note and keeps it', () => {
    const prepared = prepareAdjustment(input({ reason: 'damaged', note: '  fuga en  válvula ' }));
    expect(prepared.ok && prepared.value.note).toBe('fuga en válvula');
  });

  it('takes a blank note as none', () => {
    const prepared = prepareAdjustment(input({ note: '   ' }));
    expect(prepared.ok && prepared.value.note).toBeNull();
  });

  it('accepts a change of only one side', () => {
    expect(prepareAdjustment(input({ fullDelta: 0, emptyDelta: 3 })).ok).toBe(true);
  });

  it('accepts the largest change either way', () => {
    const largest = { fullDelta: MAX_ADJUSTMENT_UNITS, emptyDelta: -MAX_ADJUSTMENT_UNITS };
    expect(prepareAdjustment(input(largest)).ok).toBe(true);
  });

  it.each([
    ['"other" without a note', { reason: 'other' as const }, 'note', 'required'],
    ['an unknown reason', { reason: 'gift' as never }, 'reason', 'invalid'],
    ['a note too long', { note: 'n'.repeat(ADJUSTMENT_NOTE_MAX_LENGTH + 1) }, 'note', 'tooLong'],
    ['a note of punctuation', { note: '...' }, 'note', 'invalid'],
    ['a note with a zero-width space', { note: 'fuga​' }, 'note', 'invalid'],
    ['half a cylinder', { fullDelta: 0.5 }, 'fullDelta', 'invalid'],
    ['a change above the cap', { fullDelta: MAX_ADJUSTMENT_UNITS + 1 }, 'fullDelta', 'outOfRange'],
    [
      'a change below the cap',
      { emptyDelta: -MAX_ADJUSTMENT_UNITS - 1 },
      'emptyDelta',
      'outOfRange',
    ],
    ['a change that is not a number', { emptyDelta: NaN }, 'emptyDelta', 'invalid'],
    ['no change at all', { fullDelta: 0, emptyDelta: 0 }, 'fullDelta', 'required'],
  ])('rejects %s', (_case, change, field, code) => {
    expect(prepareAdjustment(input(change))).toEqual({ ok: false, issues: [{ field, code }] });
  });
});
