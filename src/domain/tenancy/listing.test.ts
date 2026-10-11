import { describe, expect, it } from 'vitest';
import { REVIEW_NOTE_MAX_LENGTH } from './constants';
import {
  answersReviewNote,
  hasReadOnlyDistributor,
  isOpenToPublic,
  listingStateOf,
  prepareReviewNote,
  statusAfterReactivation,
  touchesIdentity,
} from './listing';
import { DISTRIBUTOR_STATUSES, type DistributorStatus } from './types';

const NOW = new Date('2026-10-11T12:00:00Z');
const LATER = new Date('2026-10-20T12:00:00Z');
const BEFORE = new Date('2026-10-01T12:00:00Z');

const control = (status: DistributorStatus, trialEndsAt: Date, listingApproved: boolean) => ({
  status,
  trialEndsAt,
  listingApproved,
  reviewNote: null as string | null,
  correctedAt: null as Date | null,
});

describe('isOpenToPublic', () => {
  it.each([
    ['active', BEFORE, true, true],
    ['active', BEFORE, false, false],
    ['trial', LATER, true, true],
    ['trial', LATER, false, false],
    ['trial', BEFORE, true, false],
    ['pastDue', LATER, true, false],
    ['suspended', LATER, true, false],
  ] as const)('%s, trial end %s, approved %s → %s', (status, trialEndsAt, approved, expected) => {
    expect(isOpenToPublic(control(status, trialEndsAt, approved), NOW)).toBe(expected);
  });

  it('is never open without the approval, whatever the status', () => {
    for (const status of DISTRIBUTOR_STATUSES) {
      expect(isOpenToPublic(control(status, LATER, false), NOW)).toBe(false);
    }
  });
});

describe('listingStateOf', () => {
  it('is in review until a platform admin approves it', () => {
    expect(listingStateOf(control('trial', LATER, false), NOW)).toBe('inReview');
  });

  it('asks for changes when it was sent back with a note', () => {
    const sentBack = { ...control('trial', LATER, false), reviewNote: 'El RUC no coincide.' };
    expect(listingStateOf(sentBack, NOW)).toBe('changesRequested');
  });

  // PLAN 2.11: after correcting, the owner no longer reads "changes requested".
  it('says the corrections were sent once the owner answered the note', () => {
    const answered = {
      ...control('trial', LATER, false),
      reviewNote: 'El RUC no coincide.',
      correctedAt: BEFORE,
    };
    expect(listingStateOf(answered, NOW)).toBe('correctionsSent');
  });

  it('ignores a correction mark that has no note beside it', () => {
    const stray = { ...control('trial', LATER, false), correctedAt: BEFORE };
    expect(listingStateOf(stray, NOW)).toBe('inReview');
  });

  it('never reads a correction as an approval', () => {
    const answered = { ...control('active', LATER, false), reviewNote: 'x', correctedAt: BEFORE };
    expect(listingStateOf(answered, NOW)).not.toBe('listed');
    expect(isOpenToPublic(answered, NOW)).toBe(false);
  });

  it('is listed once approved and operating', () => {
    expect(listingStateOf(control('active', BEFORE, true), NOW)).toBe('listed');
  });

  it.each(['suspended', 'pastDue'] as const)('is not operating when %s', (status) => {
    expect(listingStateOf(control(status, LATER, true), NOW)).toBe('notOperating');
  });

  it('is not operating when the trial is over', () => {
    expect(listingStateOf(control('trial', BEFORE, true), NOW)).toBe('notOperating');
  });
});

describe('answersReviewNote', () => {
  it.each([
    ['a listing that waits with a note', false, 'Revisa el RUC.', true],
    ['a listing that waits without a note', false, null, false],
    ['an approved listing', true, null, false],
    ['an approved listing that kept a note by mistake', true, 'Revisa.', false],
  ])('%s → %s', (_case, listingApproved, reviewNote, expected) => {
    expect(answersReviewNote({ listingApproved, reviewNote })).toBe(expected);
  });
});

describe('touchesIdentity', () => {
  it.each(['name', 'contactPhone', 'whatsapp'])('is true for a change of %s', (field) => {
    expect(touchesIdentity({ [field]: 'x' })).toBe(true);
  });

  it('is false for the rest of the profile', () => {
    expect(touchesIdentity({ addressLine: 'x', brandColor: '#000000', schedule: {} })).toBe(false);
    expect(touchesIdentity({})).toBe(false);
  });
});

describe('hasReadOnlyDistributor', () => {
  it('is false for an account that owns nothing', () => {
    expect(hasReadOnlyDistributor([], NOW)).toBe(false);
  });

  it('is false while every distributor may operate', () => {
    const owned = [control('active', BEFORE, true), control('trial', LATER, false)];
    expect(hasReadOnlyDistributor(owned, NOW)).toBe(false);
  });

  it.each([
    ['suspended', control('suspended', LATER, true)],
    ['past due', control('pastDue', LATER, true)],
    ['with the trial over', control('trial', BEFORE, true)],
  ])('is true when one of them is %s', (_case, readOnly) => {
    expect(hasReadOnlyDistributor([control('active', BEFORE, true), readOnly], NOW)).toBe(true);
  });
});

describe('statusAfterReactivation', () => {
  it('goes back to the trial while it still runs', () => {
    expect(statusAfterReactivation({ trialEndsAt: LATER }, NOW)).toBe('trial');
  });

  it('becomes active once the trial is over', () => {
    expect(statusAfterReactivation({ trialEndsAt: BEFORE }, NOW)).toBe('active');
    expect(statusAfterReactivation({ trialEndsAt: NOW }, NOW)).toBe('active');
  });
});

describe('prepareReviewNote', () => {
  it('trims the note', () => {
    expect(prepareReviewNote('  El RUC no coincide.  ')).toEqual({
      ok: true,
      value: 'El RUC no coincide.',
    });
  });

  it('accepts no note at all', () => {
    expect(prepareReviewNote('   ')).toEqual({ ok: true, value: '' });
  });

  it('accepts a note at the maximum length and refuses one character more', () => {
    expect(prepareReviewNote('n'.repeat(REVIEW_NOTE_MAX_LENGTH)).ok).toBe(true);
    expect(prepareReviewNote('n'.repeat(REVIEW_NOTE_MAX_LENGTH + 1))).toEqual({
      ok: false,
      issues: [{ field: 'reviewNote', code: 'tooLong' }],
    });
  });
});
