import type { ReactNode } from 'react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/common/state-views';
import { Panel } from '@/components/layout/page-header';
import { PromotionListSkeleton } from '@/components/promotions/promotion-card';
import type { Product } from '@/domain/catalog/product';
import { MAX_PROMOTIONS } from '@/domain/pricing/constants';
import type { Promotion } from '@/domain/pricing/promotion';
import type { Distributor } from '@/domain/tenancy/types';
import { useOnlineStatus } from '@/lib/use-online-status';
import { cn } from '@/lib/utils';
import { PromotionEditPanel } from './promotion-edit-panel';
import { PromotionFormPanel } from './promotion-form-panel';
import { groupPromotions, PromotionList } from './promotion-list';

/** What the screen is doing besides listing: adding (maybe repeating one) or editing one. */
export type PromotionMode =
  { kind: 'add'; repeat: Promotion | null } | { kind: 'edit'; promotion: Promotion } | null;

type PromotionsBoardProps = {
  distributor: Distributor;
  uid: string;
  promotions: readonly Promotion[] | null;
  products: readonly Product[] | null;
  isRefreshing: boolean;
  /** The moment the list is judged at (`nowAfter`). */
  now: Date;
  canEdit: boolean;
  mode: PromotionMode;
  onMode: (mode: PromotionMode) => void;
  /** "Añadir promoción" for the empty list. */
  addButton: ReactNode;
  reload: () => void;
};

/**
 * The promotions (PLAN 3.5): alive first, then the ones that are over, with their actions for
 * the owner and the dispatcher. Adding takes the whole screen; editing opens beside the list on
 * a desktop and in its place on a phone, like the catalogue.
 */
export function PromotionsBoard(props: PromotionsBoardProps) {
  const { distributor, uid, promotions, products, isRefreshing, now, canEdit, mode, onMode } =
    props;
  const isOnline = useOnlineStatus();
  const saved = (message: string) => {
    toast.success(message);
    onMode(null);
    props.reload();
  };

  if (mode?.kind === 'add' && promotions && products) {
    return (
      <PromotionFormPanel
        key={mode.repeat?.id ?? 'new'}
        distributor={distributor}
        uid={uid}
        catalog={products}
        promotions={promotions}
        repeat={mode.repeat}
        onSaved={saved}
        onCancel={() => onMode(null)}
      />
    );
  }

  const groups = promotions && groupPromotions(promotions, now);
  const editing = mode?.kind === 'edit' ? mode.promotion : null;
  const controls =
    canEdit && !editing
      ? {
          distributorId: distributor.id,
          uid,
          isLocked: isRefreshing || !isOnline,
          onEdit: (promotion: Promotion) => onMode({ kind: 'edit', promotion }),
          onRepeat: (promotion: Promotion) => onMode({ kind: 'add', repeat: promotion }),
          reload: props.reload,
        }
      : undefined;
  const list = (items: readonly Promotion[]) => (
    <PromotionList
      promotions={items}
      products={products ?? []}
      now={now}
      currency={distributor.currency}
      controls={controls}
    />
  );

  return (
    <div
      className={cn(
        'grid grid-cols-[minmax(0,1fr)] items-start gap-4',
        editing && 'lg:grid-cols-[minmax(0,1fr)_26rem]',
      )}
    >
      <div className={cn('flex flex-col gap-4', editing && 'max-lg:hidden')}>
        <Panel dense>
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 className="text-lg font-bold">Activas y programadas</h2>
            {promotions && (
              <p className="text-sm font-semibold text-muted-foreground tabular-nums">
                {groups?.alive.length ?? 0} de {MAX_PROMOTIONS}
              </p>
            )}
          </div>
          {!groups || !products ? (
            <PromotionListSkeleton />
          ) : groups.alive.length === 0 ? (
            <EmptyState
              className="py-4"
              title={canEdit ? 'Todavía no tienes promociones.' : 'No hay promociones activas.'}
              description={
                canEdit
                  ? 'Crea la primera en un minuto.'
                  : 'Las crean el titular o la central de la distribuidora.'
              }
              action={canEdit && props.addButton}
            />
          ) : (
            list(groups.alive)
          )}
        </Panel>
        {groups && products && groups.over.length > 0 && (
          <Panel dense>
            <h2 className="text-lg font-bold">Terminadas y apagadas</h2>
            {list(groups.over)}
          </Panel>
        )}
      </div>
      {editing && (
        <Panel dense>
          <PromotionEditPanel
            key={editing.id}
            distributorId={distributor.id}
            promotion={editing}
            onSaved={saved}
            onCancel={() => onMode(null)}
          />
        </Panel>
      )}
    </div>
  );
}
