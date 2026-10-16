// PLAN 4.6: every cancellation records a reason; `other` and taking a driver off need a note.
import { describe, expect, it } from 'vitest';
import { ORDER_NOTE_MAX_LENGTH } from './constants';
import {
  CANCEL_REASONS,
  cancellationIssue,
  CUSTOMER_CANCEL_REASON,
  isCancelReason,
  isOrderNote,
} from './reasons';

describe('cancel reasons', () => {
  it('include "Sin balón vacío" (marketing §2.5) and the customer reason', () => {
    expect(CANCEL_REASONS).toContain('noEmptyCylinder');
    expect(CANCEL_REASONS).toContain(CUSTOMER_CANCEL_REASON);
  });

  it.each([['other'], ['outOfStock']])('recognise %s', (value) => {
    expect(isCancelReason(value)).toBe(true);
  });

  it.each([['Other'], [''], [null], ['sinBalon']])('reject %j', (value) => {
    expect(isCancelReason(value)).toBe(false);
  });
});

describe('isOrderNote', () => {
  it.each([
    ['plain text', 'No contesta'],
    ['accents, ñ and emoji', 'Piña dijo que volverá 🙂'],
    ['exactly the maximum', 'a'.repeat(ORDER_NOTE_MAX_LENGTH)],
  ])('accepts %s', (_case, note) => {
    expect(isOrderNote(note)).toBe(true);
  });

  it.each([
    ['empty', ''],
    ['spaces', '   '],
    ['emoji alone', '🙂'],
    ['a zero-width space inside', 'No​contesta'],
    ['a right-to-left override', '‮etsetnoc oN'],
    ['one over the maximum', 'a'.repeat(ORDER_NOTE_MAX_LENGTH + 1)],
  ])('rejects %s', (_case, note) => {
    expect(isOrderNote(note)).toBe(false);
  });
});

describe('cancellationIssue', () => {
  it.each([
    ['the customer, no note', { reason: 'customerRequest', note: null }, true],
    ['the office, a code without note', { reason: 'outOfCoverage', note: null }, false],
    ['the office, other with a note', { reason: 'other', note: 'Cliente se mudó' }, false],
    ['the office on behalf of the customer', { reason: 'customerRequest', note: null }, false],
  ] as const)('accepts %s', (_case, cancellation, byCustomer) => {
    expect(cancellationIssue(cancellation, byCustomer)).toBeNull();
  });

  it.each([
    ['nothing', undefined, false, 'reasonRequired'],
    ['null', null, true, 'reasonRequired'],
    [
      'the customer with an office code',
      { reason: 'duplicate', note: null },
      true,
      'customerReasonOnly',
    ],
    ['the customer with other', { reason: 'other', note: 'Nada' }, true, 'customerReasonOnly'],
    ['other without a note', { reason: 'other', note: null }, false, 'invalidNote'],
    ['a blank note', { reason: 'duplicate', note: '' }, false, 'invalidNote'],
  ] as const)('refuses %s', (_case, cancellation, byCustomer, expected) => {
    expect(cancellationIssue(cancellation, byCustomer)).toBe(expected);
  });
});
