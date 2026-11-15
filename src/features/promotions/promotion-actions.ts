import * as promotionsRepo from '../../data/promotions-repo';
import type { Product } from '../../domain/catalog/product';
import { PromotionNotEditableError } from '../../domain/pricing/errors';
import type { Promotion } from '../../domain/pricing/promotion';
import {
  editRefusal,
  preparePromotionEdit,
  type PromotionPatch,
  publishRefusal,
  switchOffRefusal,
} from '../../domain/pricing/promotion-edit';
import { preparePromotion, type PromotionInput } from '../../domain/pricing/promotion-input';
import { InvalidInputError, NothingChangedError } from '../../domain/tenancy/errors';
import { forgetVisibleDistributors } from '../tenancy/visible-distributors';

// PLAN 3.5: the owner and the dispatcher (decision of the user, §11 2026-10-16). Every write may
// change what the search page shows, so each one forgets the cached search list.

/**
 * "Añadir promoción": validates `input` against the whole catalogue at `now` and saves it in a
 * free slot, locking the prices of its products until its end. Returns the slot. Throws
 * `InvalidInputError`, `PromotionsFullError`, `StalePromotionError` (try again),
 * `PermissionDeniedError` (a driver, someone outside, a read-only distributor) or `OfflineError`.
 */
export async function addPromotion(
  distributorId: string,
  uid: string,
  input: PromotionInput,
  catalog: readonly Product[],
  now = new Date(),
): Promise<string> {
  const prepared = preparePromotion(input, catalog, now);
  if (!prepared.ok) throw new InvalidInputError(prepared.issues);
  const slot = await promotionsRepo.createPromotion(distributorId, uid, prepared.value, now);
  forgetVisibleDistributors();
  return slot;
}

/**
 * Renames or extends a promotion that has not ended nor been switched off. Throws
 * `PromotionNotEditableError`, `InvalidInputError`, `NothingChangedError` and the repository's.
 */
export async function editPromotion(
  distributorId: string,
  current: Promotion,
  patch: PromotionPatch,
  now = new Date(),
): Promise<void> {
  const refusal = editRefusal(current, now);
  if (refusal) throw new PromotionNotEditableError(refusal);
  const prepared = preparePromotionEdit(current, patch);
  if (!prepared.ok) throw new InvalidInputError(prepared.issues);
  if (Object.keys(prepared.value).length === 0) throw new NothingChangedError();
  await promotionsRepo.updatePromotion(distributorId, current.id, prepared.value);
  forgetVisibleDistributors();
}

/** Publishes one saved without publishing. Throws `PromotionNotEditableError` and the repository's. */
export async function publishPromotion(
  distributorId: string,
  promotion: Promotion,
  now = new Date(),
): Promise<void> {
  const refusal = publishRefusal(promotion, now);
  if (refusal) throw new PromotionNotEditableError(refusal);
  await promotionsRepo.publishPromotion(distributorId, promotion.id);
  forgetVisibleDistributors();
}

/**
 * "Apagar": final, records who and when. The prices of its products stay locked until the end
 * it announced. Answers `alreadyOff` when someone else switched it off first (nothing written).
 * Throws `PromotionNotEditableError` and the repository's.
 */
export async function switchOffPromotion(
  distributorId: string,
  uid: string,
  promotion: Promotion,
  now = new Date(),
): Promise<promotionsRepo.SwitchOffOutcome> {
  const refusal = switchOffRefusal(promotion, now);
  if (refusal) throw new PromotionNotEditableError(refusal);
  const outcome = await promotionsRepo.switchOffPromotion(distributorId, promotion.id, uid);
  forgetVisibleDistributors();
  return outcome;
}
