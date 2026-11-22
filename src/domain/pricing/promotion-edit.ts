import {
  type Check,
  checkVisibleText,
  type FieldIssue,
  type Validated,
} from '../tenancy/field-checks';
import { MAX_PROMOTION_DAYS, PROMOTION_TITLE_MAX_LENGTH } from './constants';
import type { PromotionRefusal } from './errors';
import { type Promotion, promotionStateOf } from './promotion';

// A saved promotion keeps its price, products, kind, way of selling, caps and start: changing
// them is another promotion (PLAN §11, 2026-10-16; marketing §4). Firebase/firestore.rules hold
// the same three edits.

/** What may change in a saved promotion: its name and a later end. */
export type PromotionPatch = Partial<Pick<Promotion, 'title' | 'endsAt'>>;

const MS_PER_DAY = 86_400_000;
const SPACES = /\s+/g;
const issue = (field: string, code: Check): FieldIssue[] => (code ? [{ field, code }] : []);

/** Renaming or extending needs a promotion that has not ended nor been switched off. */
export function editRefusal(promotion: Promotion, now: Date): PromotionRefusal | null {
  const state = promotionStateOf(promotion, now);
  return state === 'switchedOff' || state === 'ended' ? state : null;
}

function checkEnd(promotion: Promotion, endsAt: Date): Check {
  if (endsAt.getTime() < promotion.endsAt.getTime()) return 'invalid';
  const length = endsAt.getTime() - promotion.startsAt.getTime();
  return length > MAX_PROMOTION_DAYS * MS_PER_DAY ? 'outOfRange' : null;
}

/**
 * Normalises and validates a rename or an extension, keeping only what changes. An end never
 * moves earlier (customers saw it; `invalid`) nor beyond 30 days from the start (`outOfRange`).
 * An empty result changes nothing.
 */
export function preparePromotionEdit(
  promotion: Promotion,
  patch: PromotionPatch,
): Validated<PromotionPatch> {
  const changes: PromotionPatch = {};
  const title = patch.title?.trim().replace(SPACES, ' ');
  if (title !== undefined && title !== promotion.title) changes.title = title;
  if (patch.endsAt && patch.endsAt.getTime() !== promotion.endsAt.getTime()) {
    changes.endsAt = patch.endsAt;
  }
  const issues = [
    ...(changes.title === undefined
      ? []
      : issue('title', checkVisibleText(changes.title, 1, PROMOTION_TITLE_MAX_LENGTH))),
    ...(changes.endsAt === undefined ? [] : issue('endsAt', checkEnd(promotion, changes.endsAt))),
  ];
  return issues.length > 0 ? { ok: false, issues } : { ok: true, value: changes };
}

/** Publishing one saved without publishing: only before its end, and never once switched off. */
export function publishRefusal(promotion: Promotion, now: Date): PromotionRefusal | null {
  const state = promotionStateOf(promotion, now);
  if (state === 'switchedOff' || state === 'ended') return state;
  return state === 'draft' ? null : 'alreadyPublished';
}

/**
 * Switching off a published promotion before its end (final; it records who and when). One saved
 * without publishing has nothing to switch off, and one that ended is already over.
 */
export function switchOffRefusal(promotion: Promotion, now: Date): PromotionRefusal | null {
  const state = promotionStateOf(promotion, now);
  if (state === 'switchedOff' || state === 'ended') return state;
  return state === 'draft' ? 'notPublished' : null;
}
