import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { PromotionCard } from '@/components/promotions/promotion-card';
import type { Product } from '@/domain/catalog/product';
import { type Promotion, promotionStateOf } from '@/domain/pricing/promotion';
import { publishPromotion, switchOffPromotion } from '@/features/promotions/promotion-actions';
import { describePromotionError } from '@/features/promotions/promotion-messages';
import { useOnlineStatus } from '@/lib/use-online-status';
import { PromotionRowActions } from './promotion-row-actions';

const LIVE_ORDER = ['live', 'soldOut', 'scheduled', 'draft'] as const;

/** Alive (live, at its cap, scheduled, unpublished) and over, each newest first. */
export function groupPromotions(promotions: readonly Promotion[], now: Date) {
  const byStart = (a: Promotion, b: Promotion) => b.startsAt.getTime() - a.startsAt.getTime();
  const rank = (promotion: Promotion) =>
    (LIVE_ORDER as readonly string[]).indexOf(promotionStateOf(promotion, now));
  const alive = promotions.filter((promotion) => rank(promotion) >= 0);
  const over = promotions.filter((promotion) => rank(promotion) < 0);
  return {
    alive: alive.sort((a, b) => rank(a) - rank(b) || byStart(a, b)),
    over: over.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()),
  };
}

/** What the owner and the dispatcher can ask from the list. */
export interface PromotionListControls {
  distributorId: string;
  uid: string;
  isLocked: boolean;
  onEdit: (promotion: Promotion) => void;
  onRepeat: (promotion: Promotion) => void;
  reload: () => void;
}

type PromotionListProps = {
  promotions: readonly Promotion[];
  products: readonly Product[];
  now: Date;
  currency: string;
  controls?: PromotionListControls;
};

/** A group of promotions with, for whoever manages them, the actions of each (PLAN 3.5). */
export function PromotionList({
  promotions,
  products,
  now,
  currency,
  controls,
}: PromotionListProps) {
  const isOnline = useOnlineStatus();
  const [busy, setBusy] = useState<{ id: string; what: 'publish' | 'switchOff' } | null>(null);
  const isRunning = useRef(false);

  const write = async (promotion: Promotion, what: 'publish' | 'switchOff') => {
    if (!controls || isRunning.current) return;
    isRunning.current = true;
    setBusy({ id: promotion.id, what });
    try {
      if (what === 'publish') await publishPromotion(controls.distributorId, promotion);
      else await switchOffPromotion(controls.distributorId, controls.uid, promotion);
      toast.success(
        what === 'publish' ? `Publicamos “${promotion.title}”.` : `Apagamos “${promotion.title}”.`,
      );
    } catch (error) {
      toast.error(describePromotionError(error));
    } finally {
      isRunning.current = false;
      setBusy(null);
      controls.reload();
    }
  };

  return (
    <ul className="flex flex-col divide-y">
      {promotions.map((promotion) => (
        <li key={`${promotion.id}:${promotion.createdAt.getTime()}`}>
          <PromotionCard promotion={promotion} products={products} now={now} currency={currency}>
            {controls && (
              <PromotionRowActions
                promotion={promotion}
                now={now}
                busy={busy?.id === promotion.id ? busy.what : null}
                isLocked={controls.isLocked || busy !== null || !isOnline}
                onEdit={() => controls.onEdit(promotion)}
                onRepeat={() => controls.onRepeat(promotion)}
                onPublish={() => void write(promotion, 'publish')}
                onSwitchOff={() => void write(promotion, 'switchOff')}
              />
            )}
          </PromotionCard>
        </li>
      ))}
    </ul>
  );
}
