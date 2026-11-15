import { Pencil, Power, Repeat, Send } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/common/button';
import { ConfirmPanel } from '@/components/common/confirm-panel';
import { type Promotion, promotionStateOf } from '@/domain/pricing/promotion';
import { DEFAULT_TIMEZONE } from '@/domain/tenancy/constants';
import { whenText } from '@/features/promotions/promotion-texts';
import { ICON_STROKE } from '@/lib/icons';

type PromotionRowActionsProps = {
  promotion: Promotion;
  now: Date;
  /** What is waiting for the database: this promotion's publish or switch-off. */
  busy: 'publish' | 'switchOff' | null;
  isLocked: boolean;
  onEdit: () => void;
  onRepeat: () => void;
  onPublish: () => void;
  onSwitchOff: () => void;
};

/**
 * What the owner and the dispatcher can do with one promotion (PLAN §11, 2026-10-16): rename or
 * extend it and switch it off while it lasts, publish one saved without publishing, and repeat
 * one that is over. Switching off is final and asks first (marketing §4, ui-system §14).
 */
export function PromotionRowActions(props: PromotionRowActionsProps) {
  const { promotion, now, busy, isLocked, onEdit, onRepeat, onPublish, onSwitchOff } = props;
  const [isAsking, setAsking] = useState(false);
  const state = promotionStateOf(promotion, now);
  const name = <span className="sr-only"> {promotion.title}</span>;

  if (state === 'ended' || state === 'switchedOff') {
    return (
      <div className="flex justify-end">
        <Button type="button" variant="line" size="sm" disabled={isLocked} onClick={onRepeat}>
          <Repeat aria-hidden="true" strokeWidth={ICON_STROKE} />
          Repetir{name}
        </Button>
      </div>
    );
  }

  if (isAsking) {
    return (
      <ConfirmPanel
        title="¿Apagar esta promoción ahora?"
        actions={
          <>
            <Button type="button" variant="line" onClick={() => setAsking(false)}>
              No, dejarla
            </Button>
            <Button
              type="button"
              variant="ink"
              loading={busy === 'switchOff'}
              loadingLabel="Apagando…"
              onClick={onSwitchOff}
            >
              Sí, apagarla
            </Button>
          </>
        }
      >
        <p className="mt-1.5 text-[0.9375rem] text-muted-foreground">
          Anunciaste que duraba hasta {whenText(promotion.endsAt, DEFAULT_TIMEZONE)} Los pedidos ya
          hechos conservan su precio. Apagarla es definitivo, y hasta esa fecha los precios de sus
          productos siguen sin poder subir.
        </p>
      </ConfirmPanel>
    );
  }

  return (
    <div className="flex flex-wrap justify-end gap-2">
      <Button type="button" variant="line" size="sm" disabled={isLocked} onClick={onEdit}>
        <Pencil aria-hidden="true" strokeWidth={ICON_STROKE} />
        Editar{name}
      </Button>
      {state === 'draft' ? (
        <Button
          type="button"
          variant="soft"
          size="sm"
          disabled={isLocked && busy !== 'publish'}
          loading={busy === 'publish'}
          loadingLabel="Publicando…"
          onClick={onPublish}
        >
          <Send aria-hidden="true" strokeWidth={ICON_STROKE} />
          Publicar{name}
        </Button>
      ) : (
        <Button
          type="button"
          variant="quiet"
          size="sm"
          disabled={isLocked}
          onClick={() => setAsking(true)}
        >
          <Power aria-hidden="true" strokeWidth={ICON_STROKE} />
          Apagar{name}
        </Button>
      )}
    </div>
  );
}
