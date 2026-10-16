import {
  collection,
  doc,
  getDocs,
  limit,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  type Transaction,
  where,
} from 'firebase/firestore';
import { PROMOTIONS_QUERY_LIMIT, MAX_PROMOTIONS } from '../domain/pricing/constants';
import {
  PromotionNotFoundError,
  PromotionsFullError,
  StalePromotionError,
} from '../domain/pricing/errors';
import { locksToRaise } from '../domain/pricing/price-lock';
import {
  freePromotionSlot,
  type NewPromotion,
  type Promotion,
  type PromotionDeal,
} from '../domain/pricing/promotion';
import type { PromotionPatch } from '../domain/pricing/promotion-edit';
import { productConverter, promotionConverter } from './converters';
import { guarded } from './errors';
import { db } from './firebase';
import { paths } from './paths';

const promotionsRef = (d: string) =>
  collection(db, paths.promotions(d)).withConverter(promotionConverter);
const promotionRef = (d: string, slot: string) => doc(db, paths.promotion(d, slot));
const productRef = (d: string, slot: string) => doc(db, paths.product(d, slot));

/**
 * Every slot of promotions of a distributor, unpublished and over included. Its staff only.
 * One query: one read per promotion (one when there is none) plus 1 by the rules.
 */
export function listPromotions(d: string): Promise<Promotion[]> {
  return guarded(async () => {
    const all = query(promotionsRef(d), limit(PROMOTIONS_QUERY_LIMIT));
    return (await getDocs(all)).docs.map((promotion) => promotion.data());
  });
}

/**
 * The published promotions that have not ended at `now`: what the customer may see (PLAN 3.5,
 * D13). Anyone, while the distributor takes orders. A scheduled one comes too: the screen hides
 * it (`isLive`). Index: promotions (active, endsAt). Cost: one read per promotion (one for none)
 * plus 1 by the rules.
 */
export function listPublicPromotions(d: string, now: Date): Promise<Promotion[]> {
  return guarded(async () => {
    const open = query(
      promotionsRef(d),
      where('active', '==', true),
      where('endsAt', '>', Timestamp.fromDate(now)),
      limit(PROMOTIONS_QUERY_LIMIT),
    );
    return (await getDocs(open)).docs.map((promotion) => promotion.data());
  });
}

function dealFields(deal: PromotionDeal): Record<string, unknown> {
  switch (deal.type) {
    case 'fixedPrice':
      return {
        type: deal.type,
        priceSource: deal.priceSource,
        priceCents: deal.priceSource === 'own' ? deal.priceCents : null,
      };
    case 'percentOff':
      return { type: deal.type, percent: deal.percent };
    case 'amountOff':
      return { type: deal.type, amountCents: deal.amountCents };
    case 'buyXPayY':
      return { type: deal.type, buyUnits: deal.buyUnits, payUnits: deal.payUnits };
  }
}

/** The exact document the rules expect. */
function promotionDocument(promotion: NewPromotion, uid: string) {
  return {
    title: promotion.title,
    ...dealFields(promotion.deal),
    productIds: [...promotion.productIds],
    saleMode: promotion.saleMode,
    startsAt: promotion.startsAt === 'now' ? serverTimestamp() : promotion.startsAt,
    endsAt: promotion.endsAt,
    active: promotion.active,
    maxUnitsPerOrder: promotion.maxUnitsPerOrder,
    totalUnits: promotion.totalUnits,
    soldUnits: 0,
    conditions: promotion.conditions,
    createdBy: uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    switchedOffBy: null,
    switchedOffAt: null,
  };
}

/**
 * Raises the price lock of the products to `endsAt`, in the transaction (PLAN §11, 2026-10-16):
 * without it the promotion does not apply to them. Reads each product first (all reads go first).
 */
async function readLocks(tx: Transaction, d: string, productIds: readonly string[]) {
  const products = [];
  for (const id of productIds) {
    const product = (await tx.get(productRef(d, id).withConverter(productConverter))).data();
    if (product) products.push(product);
  }
  return products;
}

function writeLocks(tx: Transaction, d: string, ids: readonly string[], endsAt: Date) {
  for (const id of ids) {
    tx.update(productRef(d, id), { promotedUntil: endsAt, updatedAt: serverTimestamp() });
  }
}

/**
 * Owner or dispatcher, while writable: saves `promotion` (from `preparePromotion`) in a free slot
 * (or one whose promotion is over) and locks the prices of its products until its end, in one
 * transaction. Returns the slot. Throws `PromotionsFullError`, `StalePromotionError` (the slot was
 * taken meanwhile), `PermissionDeniedError` or `OfflineError`.
 * Cost: the slots (one read each) + one read per product + 1, one write per product whose lock
 * moves + 1. The rules add 2 lookups per write.
 */
export async function createPromotion(
  d: string,
  uid: string,
  promotion: NewPromotion,
  now: Date,
): Promise<string> {
  const slots = await listPromotions(d);
  const slot = freePromotionSlot(slots, now);
  if (slot === null) throw new PromotionsFullError(MAX_PROMOTIONS);
  const before = slots.find((stored) => stored.id === slot);
  await guarded(() =>
    runTransaction(db, async (tx) => {
      const products = await readLocks(tx, d, promotion.productIds);
      const ref = promotionRef(d, slot).withConverter(promotionConverter);
      const current = (await tx.get(ref)).data();
      if (current?.updatedAt.getTime() !== before?.updatedAt.getTime()) {
        throw new StalePromotionError();
      }
      tx.set(promotionRef(d, slot), promotionDocument(promotion, uid));
      writeLocks(
        tx,
        d,
        locksToRaise(products, promotion.productIds, promotion.endsAt),
        promotion.endsAt,
      );
    }),
  );
  return slot;
}

async function readPromotion(tx: Transaction, d: string, id: string): Promise<Promotion> {
  const promotion = (await tx.get(promotionRef(d, id).withConverter(promotionConverter))).data();
  if (!promotion) throw new PromotionNotFoundError(id);
  return promotion;
}

/**
 * Renames or extends (from `preparePromotionEdit`, never empty). A later end also extends the
 * lock of its products, in the same transaction. Throws `PromotionNotFoundError`,
 * `PermissionDeniedError` (also when it ended or was switched off meanwhile) or `OfflineError`.
 */
export function updatePromotion(d: string, id: string, patch: PromotionPatch): Promise<void> {
  return guarded(() =>
    runTransaction(db, async (tx) => {
      const promotion = await readPromotion(tx, d, id);
      const endsAt = patch.endsAt;
      const products = endsAt ? await readLocks(tx, d, promotion.productIds) : [];
      tx.update(promotionRef(d, id), { ...patch, updatedAt: serverTimestamp() });
      if (endsAt) writeLocks(tx, d, locksToRaise(products, promotion.productIds, endsAt), endsAt);
    }),
  );
}

/** Publishes one saved without publishing. Same errors as `updatePromotion`. */
export function publishPromotion(d: string, id: string): Promise<void> {
  return guarded(() =>
    runTransaction(db, async (tx) => {
      await readPromotion(tx, d, id);
      tx.update(promotionRef(d, id), { active: true, updatedAt: serverTimestamp() });
    }),
  );
}

/**
 * Switches a published one off before its end, recording who and when (final). The lock of its
 * products stays until the end that was announced (PLAN §11, 2026-10-16).
 */
export function switchOffPromotion(d: string, id: string, uid: string): Promise<void> {
  return guarded(() =>
    runTransaction(db, async (tx) => {
      await readPromotion(tx, d, id);
      tx.update(promotionRef(d, id), {
        active: false,
        switchedOffBy: uid,
        switchedOffAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }),
  );
}
