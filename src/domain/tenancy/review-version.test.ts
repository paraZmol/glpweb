import { describe, expect, it } from 'vitest';
import {
  acknowledgeReview,
  followUnreviewedChange,
  isSameReviewVersion,
  needsSecondLook,
  refuseStaleReview,
  startReviewAttention,
} from './review-version';

const OPENED = { profile: '1760000000.000001000', settings: '1760000000.000002000' };
const PROFILE_EDITED = { ...OPENED, profile: '1760000100.000000000' };
const SETTINGS_EDITED = { ...OPENED, settings: '1760000100.000000000' };
// What the reviewed data says, as the screen hands it over: an opaque text.
const CONTENT = '[{"name":"Gas Demo Norte"}]';
const EDITED_CONTENT = '[{"name":"Gas Demo Sur"}]';

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
    expect(needsSecondLook(startReviewAttention(OPENED, CONTENT), OPENED)).toBe(false);
  });

  it.each([
    ['the public profile', PROFILE_EDITED],
    ['the private settings', SETTINGS_EDITED],
  ])('asks for a second look when %s changes on the screen', (_what, shown) => {
    expect(needsSecondLook(startReviewAttention(OPENED, CONTENT), shown)).toBe(true);
  });

  it('does not move what was seen because new data was displayed', () => {
    const attention = startReviewAttention(OPENED, CONTENT);

    expect(attention.seen).toEqual(OPENED);
    expect(needsSecondLook(attention, PROFILE_EDITED)).toBe(true);
    expect(needsSecondLook(attention, PROFILE_EDITED)).toBe(true);
  });

  it('asks for a second look after a refused approval, even before the new data arrives', () => {
    const refused = refuseStaleReview(startReviewAttention(OPENED, CONTENT));

    expect(needsSecondLook(refused, OPENED)).toBe(true);
    expect(refused.seen).toEqual(OPENED);
  });

  it('moves what was seen only when the admin acknowledges the new data', () => {
    const refused = refuseStaleReview(startReviewAttention(OPENED, CONTENT));

    const acknowledged = acknowledgeReview(PROFILE_EDITED, EDITED_CONTENT);

    expect(needsSecondLook(refused, PROFILE_EDITED)).toBe(true);
    expect(acknowledged.seen).toEqual(PROFILE_EDITED);
    expect(needsSecondLook(acknowledged, PROFILE_EDITED)).toBe(false);
    expect(needsSecondLook(acknowledged, SETTINGS_EDITED)).toBe(true);
  });

  // role-walker 2026-10-12 (B4): suspending or reactivating stamps the public profile without
  // changing a word of it, and the screen said "La ficha cambió mientras la revisabas".
  it('follows a version that moved without changing what is reviewed', () => {
    const attention = startReviewAttention(OPENED, CONTENT);

    const followed = followUnreviewedChange(attention, PROFILE_EDITED, CONTENT);

    expect(followed.seen).toEqual(PROFILE_EDITED);
    expect(needsSecondLook(followed, PROFILE_EDITED)).toBe(false);
  });

  it('does not follow a version whose reviewed data differs in anything', () => {
    const attention = startReviewAttention(OPENED, CONTENT);

    const held = followUnreviewedChange(attention, PROFILE_EDITED, EDITED_CONTENT);

    expect(held).toBe(attention);
    expect(needsSecondLook(held, PROFILE_EDITED)).toBe(true);
  });

  it('does not follow anything after a refused approval', () => {
    const refused = refuseStaleReview(startReviewAttention(OPENED, CONTENT));

    const held = followUnreviewedChange(refused, PROFILE_EDITED, CONTENT);

    expect(held).toBe(refused);
    expect(needsSecondLook(held, PROFILE_EDITED)).toBe(true);
  });

  it('keeps the same attention while the version stands still', () => {
    const attention = startReviewAttention(OPENED, CONTENT);

    expect(followUnreviewedChange(attention, { ...OPENED }, CONTENT)).toBe(attention);
  });

  // The owner edits and then undoes the edit: the admin is looking at what it reviewed.
  it('follows a listing that came back to exactly what was looked at', () => {
    const attention = startReviewAttention(OPENED, CONTENT);
    const whileEdited = followUnreviewedChange(attention, PROFILE_EDITED, EDITED_CONTENT);
    const undone = { ...OPENED, profile: '1760000200.000000000' };

    const followed = followUnreviewedChange(whileEdited, undone, CONTENT);

    expect(needsSecondLook(whileEdited, PROFILE_EDITED)).toBe(true);
    expect(followed.seen).toEqual(undone);
  });
});
