import { ArrowDown, ArrowUp, Pencil } from 'lucide-react';
import { Button } from '@/components/common/button';
import { productTitle, type Product } from '@/domain/catalog/product';
import { ICON_STROKE } from '@/lib/icons';

/** The action of a row that is waiting for the database. */
export type RowBusy = 'up' | 'down' | 'sale' | null;

type CatalogRowActionsProps = {
  product: Product;
  index: number;
  total: number;
  busy: RowBusy;
  /** Another action is running, or there is no connection: nothing here can be pressed. */
  isLocked: boolean;
  onEdit: () => void;
  onMove: (step: -1 | 1) => void;
  onToggleSale: () => void;
};

/** Attribute the page uses to give the focus back to a move button once the list is redrawn. */
export const MOVE_ATTRIBUTE = 'data-move';
export const moveKey = (productId: string, step: -1 | 1) => `${productId}:${step}`;
/** The same for "Quitar de la venta" / "Poner a la venta"; its value is the product id. */
export const SALE_ATTRIBUTE = 'data-sale';

/**
 * The owner's controls on one product (PLAN 3.1): move it up or down (buttons, so a keyboard
 * and a screen reader can reorder too), edit it, and take it off sale or put it back. Taking it
 * off sale asks nothing: it is undone with one tap and nothing is lost.
 */
export function CatalogRowActions(props: CatalogRowActionsProps) {
  const { product, index, total, busy, isLocked, onEdit, onMove, onToggleSale } = props;
  const title = productTitle(product);
  const isWaiting = busy !== null;
  const moveButton = (step: -1 | 1) => {
    const isEdge = step === -1 ? index === 0 : index === total - 1;
    const Icon = step === -1 ? ArrowUp : ArrowDown;
    return (
      <Button
        type="button"
        variant="line"
        size="sm"
        className="w-10 px-0"
        aria-label={`${step === -1 ? 'Subir' : 'Bajar'} ${title}`}
        {...{ [MOVE_ATTRIBUTE]: moveKey(product.id, step) }}
        disabled={isEdge || (isLocked && !isWaiting)}
        loading={busy === (step === -1 ? 'up' : 'down')}
        loadingLabel="Moviendo…"
        onClick={() => onMove(step)}
      >
        <Icon aria-hidden="true" strokeWidth={ICON_STROKE} />
      </Button>
    );
  };

  return (
    // Phone: the arrows stand to the right of the name, the two buttons under the prices.
    <div className="contents lg:flex lg:w-96 lg:items-center lg:justify-end lg:gap-2">
      <div className="col-start-3 row-span-2 row-start-1 flex flex-col gap-1.5 self-start lg:flex-row">
        {moveButton(-1)}
        {moveButton(1)}
      </div>
      <div className="col-span-2 col-start-2 flex justify-end gap-2">
        <Button type="button" variant="line" size="sm" disabled={isLocked} onClick={onEdit}>
          <Pencil aria-hidden="true" strokeWidth={ICON_STROKE} />
          Editar<span className="sr-only"> {title}</span>
        </Button>
        <Button
          type="button"
          variant={product.active ? 'quiet' : 'soft'}
          size="sm"
          {...{ [SALE_ATTRIBUTE]: product.id }}
          disabled={isLocked && busy !== 'sale'}
          loading={busy === 'sale'}
          loadingLabel="Guardando…"
          onClick={onToggleSale}
        >
          {product.active ? 'Quitar de la venta' : 'Poner a la venta'}
          <span className="sr-only"> {title}</span>
        </Button>
      </div>
    </div>
  );
}
