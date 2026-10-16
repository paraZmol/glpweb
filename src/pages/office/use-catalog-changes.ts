import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  MOVE_ATTRIBUTE,
  moveKey,
  type RowBusy,
  SALE_ATTRIBUTE,
} from '@/components/catalog/catalog-row-actions';
import { StaleCatalogError } from '@/domain/catalog/errors';
import { type Product, productTitle } from '@/domain/catalog/product';
import { moveProduct, setProductOnSale } from '@/features/catalog/catalog-actions';
import { describeCatalogError } from '@/features/catalog/catalog-messages';

interface Pending {
  productId: string;
  busy: Exclude<RowBusy, null>;
}

interface CatalogChangesInput {
  distributorId: string;
  /** The list as the screen shows it. */
  products: readonly Product[] | null;
  /** Loads the catalogue again after a write. */
  reload: () => void;
}

/** The control that keeps the place of the keyboard once the list is redrawn. */
type FocusTarget = { productId: string; step: -1 | 1 } | { productId: string; step: null };

const buttonFor = (selector: string) => document.querySelector<HTMLButtonElement>(selector);

/** The button the target names; at an end of the list a move falls on the other arrow. */
function findTarget({ productId, step }: FocusTarget): HTMLButtonElement | null {
  if (step === null) return buttonFor(`[${SALE_ATTRIBUTE}="${productId}"]`);
  const arrow = (which: -1 | 1) => buttonFor(`[${MOVE_ATTRIBUTE}="${moveKey(productId, which)}"]`);
  const same = arrow(step);
  return same && !same.disabled ? same : arrow(step === -1 ? 1 : -1);
}

/**
 * Gives the focus back to the button that was pressed (an arrow, or "Quitar de la venta" that
 * turns into "Poner a la venta"), wherever its row went: while the write runs the buttons wait
 * disabled, and a disabled button drops the focus to the page.
 */
function useFocusAfterChange(products: readonly Product[] | null) {
  const target = useRef<FocusTarget | null>(null);
  useEffect(() => {
    const wanted = target.current;
    if (!wanted || !products) return;
    target.current = null;
    findTarget(wanted)?.focus();
  }, [products]);
  return (next: FocusTarget) => {
    target.current = next;
  };
}

/**
 * The quick changes on the list (PLAN 3.1): move a product and put it on sale or take it off.
 * One at a time; each one waits for the database and then loads the list again. What moved is
 * also said to screen readers ("pasó al puesto 2 de 5"). A move is made on the order stored now:
 * when the screen was behind, it says so ("El catálogo cambió…").
 */
export function useCatalogChanges({ distributorId, products, reload }: CatalogChangesInput) {
  const [pending, setPending] = useState<Pending | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const focusAfterChange = useFocusAfterChange(products);
  // A second tap before the screen redraws must not start a second write.
  const isRunning = useRef(false);

  async function attempt<T>(next: Pending, write: () => Promise<T>): Promise<{ value: T } | null> {
    if (isRunning.current) return null;
    isRunning.current = true;
    setPending(next);
    try {
      return { value: await write() };
    } catch (error) {
      toast.error(describeCatalogError(error));
      if (error instanceof StaleCatalogError) reload();
      return null;
    } finally {
      isRunning.current = false;
      setPending(null);
    }
  }

  const move = async (product: Product, step: -1 | 1) => {
    if (!products) return;
    const busy = step === -1 ? 'up' : 'down';
    const done = await attempt({ productId: product.id, busy }, () =>
      moveProduct(distributorId, products, product.id, step),
    );
    if (!done) return;
    const { position, total, wasBehind } = done.value;
    const moved = `${productTitle(product)} pasó al puesto ${position} de ${total}.`;
    focusAfterChange({ productId: product.id, step });
    setAnnouncement(moved);
    if (wasBehind) {
      toast.info(`El catálogo cambió en otra pantalla. ${moved} Revisa el orden.`);
    }
    reload();
  };

  const toggleSale = async (product: Product) => {
    const isOnSale = !product.active;
    const done = await attempt({ productId: product.id, busy: 'sale' }, () =>
      setProductOnSale(distributorId, product, isOnSale),
    );
    if (!done) return;
    const title = productTitle(product);
    focusAfterChange({ productId: product.id, step: null });
    toast.success(
      isOnSale
        ? `${title} está a la venta otra vez.`
        : `${title} ya no está a la venta. Tus clientes no lo ven.`,
    );
    reload();
  };

  const busyOf = (product: Product): RowBusy =>
    pending?.productId === product.id ? pending.busy : null;

  return { busyOf, isBusy: pending !== null, announcement, move, toggleSale };
}
