import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { MOVE_ATTRIBUTE, moveKey, type RowBusy } from '@/components/catalog/catalog-row-actions';
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

/** Gives the focus back to the button that moved a product, wherever its row went. */
function useFocusAfterMove(products: readonly Product[] | null) {
  const target = useRef<{ productId: string; step: -1 | 1 } | null>(null);
  useEffect(() => {
    const wanted = target.current;
    if (!wanted || !products) return;
    target.current = null;
    const button = (step: -1 | 1) =>
      document.querySelector<HTMLButtonElement>(
        `[${MOVE_ATTRIBUTE}="${moveKey(wanted.productId, step)}"]`,
      );
    const same = button(wanted.step);
    // At an end of the list its button is disabled: the other one keeps the place.
    (same && !same.disabled ? same : button(wanted.step === -1 ? 1 : -1))?.focus();
  }, [products]);
  return (productId: string, step: -1 | 1) => {
    target.current = { productId, step };
  };
}

/**
 * The owner's quick changes on the list (PLAN 3.1): move a product and put it on sale or take
 * it off. One at a time; each one waits for the database and then loads the list again. What
 * moved is also said to screen readers ("pasó al puesto 2 de 5").
 */
export function useCatalogChanges({ distributorId, products, reload }: CatalogChangesInput) {
  const [pending, setPending] = useState<Pending | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const focusAfterMove = useFocusAfterMove(products);
  // A second tap before the screen redraws must not start a second write.
  const isRunning = useRef(false);

  const attempt = async (next: Pending, write: () => Promise<void>) => {
    if (isRunning.current) return false;
    isRunning.current = true;
    setPending(next);
    try {
      await write();
      return true;
    } catch (error) {
      toast.error(describeCatalogError(error));
      if (error instanceof StaleCatalogError) reload();
      return false;
    } finally {
      isRunning.current = false;
      setPending(null);
    }
  };

  const move = async (product: Product, step: -1 | 1) => {
    if (!products) return;
    const from = products.findIndex((item) => item.id === product.id);
    const busy = step === -1 ? 'up' : 'down';
    const isDone = await attempt({ productId: product.id, busy }, () =>
      moveProduct(distributorId, products, product.id, from + step),
    );
    if (!isDone) return;
    focusAfterMove(product.id, step);
    setAnnouncement(
      `${productTitle(product)} pasó al puesto ${from + step + 1} de ${products.length}.`,
    );
    reload();
  };

  const toggleSale = async (product: Product) => {
    const isOnSale = !product.active;
    const isDone = await attempt({ productId: product.id, busy: 'sale' }, () =>
      setProductOnSale(distributorId, product, isOnSale),
    );
    if (!isDone) return;
    const title = productTitle(product);
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
