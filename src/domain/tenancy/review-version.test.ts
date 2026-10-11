import { describe, expect, it } from 'vitest';
import {
  acknowledgeReview,
  isSameReviewVersion,
  needsSecondLook,
  refuseStaleReview,
  startReviewAttention,
} from './review-version';

const OPENED = { profile: '1760000000.000001000', settings: '1760000000.000002000' };
const PROFILE_EDITED = { ...OPENED, profile: '1760000100.000000000' };
const SETTINGS_EDITED = { ...OPENED, settings: '1760000100.000000000' };

// PLAN 2.11: an approval is tied to the version of the listing the admin looked at.
describe('version of a listing under review', () => {
  it('is the same only when both documents are at the same version', () => {
    expect(isSameReviewVersion(OPENED, { ...OPENED })).toBe(true);
    expect(isSameReviewVersion(OPENED, PROFILE_EDITED)).toBe(false);
    expect(isSameReviewVersion(OPENED, SETTINGS_EDITED)).toBe(false);
  });

  it('tells apart two versions less than a millisecond apart', () => {
    const next = { ...OPENED, profile: '1760000000.000001001' };

    expect(isSameReviewVersion(OPENED, next)).toBe(false);
  });

  it('asks for nothing while the screen shows what was opened', () => {
    expect(needsSecondLook(startReviewAttention(OPENED), OPENED)).toBe(false);
  });

  it.each([
    ['the public profile', PROFILE_EDITED],
    ['the private settings', SETTINGS_EDITED],
  ])('asks for a second look when %s changes on the screen', (_what, shown) => {
    expect(needsSecondLook(startReviewAttention(OPENED), shown)).toBe(true);
  });

  it('does not move what was seen because new data was displayed', () => {
    const attention = startReviewAttention(OPENED);

    expect(attention.seen).toEqual(OPENED);
    expect(needsSecondLook(attention, PROFILE_EDITED)).toBe(true);
    expect(needsSecondLook(attention, PROFILE_EDITED)).toBe(true);
  });

  it('asks for a second look after a refused approval, even before the new data arrives', () => {
    const refused = refuseStaleReview(startReviewAttention(OPENED));

    expect(needsSecondLook(refused, OPENED)).toBe(true);
    expect(refused.seen).toEqual(OPENED);
  });

  it('moves what was seen only when the admin acknowledges the new data', () => {
    const refused = refuseStaleReview(startReviewAttention(OPENED));

    const acknowledged = acknowledgeReview(PROFILE_EDITED);

    expect(needsSecondLook(refused, PROFILE_EDITED)).toBe(true);
    expect(acknowledged.seen).toEqual(PROFILE_EDITED);
    expect(needsSecondLook(acknowledged, PROFILE_EDITED)).toBe(false);
    expect(needsSecondLook(acknowledged, SETTINGS_EDITED)).toBe(true);
  });
});
