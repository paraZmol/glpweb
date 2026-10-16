import { useLocation, useNavigate } from 'react-router';
import type { Product } from '@/domain/catalog/product';

/** What the right-hand panel (the whole screen, on a phone) is doing. */
export type Editing = { product: Product | null } | null;

const FORM_KEY = 'productForm';

/** The entry of the history with the form open: which distributor, and which product (or new). */
interface FormEntry {
  distributorId: string;
  productId: string | null;
}

function readFormEntry(state: unknown): FormEntry | null {
  if (typeof state !== 'object' || state === null || !(FORM_KEY in state)) return null;
  const entry = (state as Record<string, unknown>)[FORM_KEY];
  if (typeof entry !== 'object' || entry === null) return null;
  const { distributorId, productId } = entry as Record<string, unknown>;
  if (typeof distributorId !== 'string') return null;
  return { distributorId, productId: typeof productId === 'string' ? productId : null };
}

/**
 * The product form as a step of the browser history (PLAN 3.1), like the steps of the sign-up:
 * opening it adds an entry, so "back" (or the back gesture of a phone) closes it and stays on
 * the catalogue; "Cancelar" and saving go back the same way. The entry names its distributor:
 * switching to another one closes the form. A product that is not in the list (yet) shows no form.
 */
export function useProductFormEntry(
  distributorId: string | null,
  products: readonly Product[] | null,
) {
  const location = useLocation();
  const navigate = useNavigate();
  const entry = readFormEntry(location.state);
  const isOpen = entry !== null && entry.distributorId === distributorId;

  let editing: Editing = null;
  if (isOpen && entry.productId === null) editing = { product: null };
  if (isOpen && entry.productId !== null) {
    const product = products?.find((item) => item.id === entry.productId);
    editing = product ? { product } : null;
  }

  const hasOwnEntry = entry !== null && location.key !== 'default';
  const { pathname } = location;
  const setEditing = (next: Editing) => {
    if (next === null) {
      // The entry was added by opening the form: going back keeps "forward" meaningful.
      if (hasOwnEntry) void navigate(-1);
      else void navigate(pathname, { replace: true, state: null });
      return;
    }
    if (distributorId === null) return;
    const state = { [FORM_KEY]: { distributorId, productId: next.product?.id ?? null } };
    // Switching from one product to another replaces the step instead of piling them up.
    void navigate(pathname, { replace: entry !== null, state });
  };

  return { editing, setEditing };
}
