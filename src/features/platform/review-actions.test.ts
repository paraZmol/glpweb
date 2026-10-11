import { describe, expect, it } from 'vitest';
import { REVIEW_NOTE_MAX_LENGTH } from '../../domain/tenancy/constants';
import { DISTRIBUTOR_STATUSES } from '../../domain/tenancy/types';
import { reviewActionsOf, reviewNoteProblemOf } from './review-actions';

// PLAN 2.11: what the platform panel offers on one distributor. Pure: no repository is touched.
describe('reviewActionsOf', () => {
  it.each([
    ['trial', false, ['approve', 'requestChanges', 'suspend']],
    ['active', false, ['approve', 'requestChanges', 'suspend']],
    ['trial', true, ['requestChanges', 'suspend']],
    ['active', true, ['requestChanges', 'suspend']],
    ['pastDue', true, ['requestChanges', 'suspend', 'reactivate']],
    ['pastDue', false, ['approve', 'requestChanges', 'suspend', 'reactivate']],
    ['suspended', true, ['requestChanges', 'reactivate']],
    ['suspended', false, ['approve', 'requestChanges', 'reactivate']],
  ] as const)('%s with approval %s offers %j', (status, listingApproved, actions) => {
    expect(reviewActionsOf({ status, listingApproved })).toEqual(actions);
  });

  it('never offers to approve what is approved, nor to suspend what is suspended', () => {
    for (const status of DISTRIBUTOR_STATUSES) {
      expect(reviewActionsOf({ status, listingApproved: true })).not.toContain('approve');
    }
    expect(reviewActionsOf({ status: 'suspended', listingApproved: false })).not.toContain(
      'suspend',
    );
  });

  it('offers to reactivate only what is stopped', () => {
    expect(reviewActionsOf({ status: 'trial', listingApproved: true })).not.toContain('reactivate');
    expect(reviewActionsOf({ status: 'active', listingApproved: true })).not.toContain(
      'reactivate',
    );
  });
});

describe('reviewNoteProblemOf', () => {
  it.each(['', '   ', '\n\t'])('asks for a note when it is %j', (note) => {
    expect(reviewNoteProblemOf(note)).toBe(
      'Escribe qué debe corregir: es lo que la distribuidora va a leer en su panel.',
    );
  });

  it('accepts a note up to the limit, with tildes and line breaks', () => {
    expect(reviewNoteProblemOf('El RUC no coincide con la razón social.\nRevísalo.')).toBeNull();
    expect(reviewNoteProblemOf('ñ'.repeat(REVIEW_NOTE_MAX_LENGTH))).toBeNull();
  });

  it('refuses a note longer than the limit', () => {
    expect(reviewNoteProblemOf('x'.repeat(REVIEW_NOTE_MAX_LENGTH + 1))).toBe(
      'La nota es demasiado larga. Resúmela.',
    );
  });

  it('does not count the spaces around the note against the limit', () => {
    expect(reviewNoteProblemOf(`  ${'x'.repeat(REVIEW_NOTE_MAX_LENGTH)}  `)).toBeNull();
  });
});
