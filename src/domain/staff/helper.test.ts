import { describe, expect, it } from 'vitest';
import { HELPER_NAME_MAX_LENGTH, MAX_HELPERS } from './constants';
import { freeHelperSlot, HELPER_SLOT_IDS, prepareHelperName, sortHelpers } from './helper';

describe('helper slots', () => {
  it(`are h00 … h${MAX_HELPERS - 1}, the pattern of the rules`, () => {
    expect(HELPER_SLOT_IDS).toHaveLength(MAX_HELPERS);
    expect(HELPER_SLOT_IDS.every((slot) => /^h[0-2][0-9]$/.test(slot))).toBe(true);
  });

  it('gives the first free slot, a gap included', () => {
    expect(freeHelperSlot([])).toBe('h00');
    expect(freeHelperSlot([{ id: 'h00' }, { id: 'h02' }])).toBe('h01');
  });

  it('gives null when every slot is taken', () => {
    expect(freeHelperSlot(HELPER_SLOT_IDS.map((id) => ({ id })))).toBeNull();
  });
});

describe('sortHelpers', () => {
  it('puts active helpers first, then by name', () => {
    const sorted = sortHelpers([
      { id: 'h00', name: 'Zoila', active: true },
      { id: 'h01', name: 'Ana', active: false },
      { id: 'h02', name: 'Ñuflo', active: true },
    ]);
    expect(sorted.map((helper) => helper.id)).toEqual(['h02', 'h00', 'h01']);
  });
});

describe('prepareHelperName', () => {
  it('trims and leaves single spaces', () => {
    expect(prepareHelperName('  P.   Ayudante ')).toEqual({ ok: true, value: 'P. Ayudante' });
  });

  it.each([
    ['an empty name', '   ', 'required'],
    ['a name too long', 'n'.repeat(HELPER_NAME_MAX_LENGTH + 1), 'tooLong'],
    ['punctuation only', '--', 'invalid'],
    ['a zero-width space inside', 'P.​Ayudante', 'invalid'],
  ])('refuses %s', (_case, raw, code) => {
    expect(prepareHelperName(raw)).toEqual({ ok: false, issues: [{ field: 'name', code }] });
  });
});
