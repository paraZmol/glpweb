import type { Product } from '@/domain/catalog/product';
import { useFormEntry } from './use-form-entry';

/** What the right-hand panel (the whole screen, on a phone) is doing. */
export type Editing = { product: Product | null } | null;

/**
 * The product form as a step of the browser history (`useFormEntry`): "back" closes it and stays
 * on the catalogue. A product that is not in the list (yet) shows no form.
 */
export function useProductFormEntry(
  distributorId: string | null,
  products: readonly Product[] | null,
) {
  const entry = useFormEntry('productForm', distributorId);

  let editing: Editing = null;
  if (entry.value === null) editing = { product: null };
  if (typeof entry.value === 'string') {
    const product = products?.find((item) => item.id === entry.value);
    editing = product ? { product } : null;
  }

  const setEditing = (next: Editing) => {
    if (next === null) entry.close();
    else entry.open(next.product?.id ?? null);
  };

  return { editing, setEditing };
}
