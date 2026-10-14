import { type FormEvent, useEffect, useRef, useState } from 'react';
import { FormStatus } from '@/components/account/form-parts';
import { ProductFields, type SetProductField } from '@/components/catalog/product-fields';
import { Button } from '@/components/common/button';
import { defaultProductName, type Product, productTitle } from '@/domain/catalog/product';
import type { ProductInput } from '@/domain/catalog/product-input';
import { addProduct, editProduct } from '@/features/catalog/catalog-actions';
import {
  emptyProductForm,
  type ProductFormErrors,
  productFormErrorsOf,
  productFormOf,
  productPatchOf,
  readProductForm,
} from '@/features/catalog/product-form';
import { useAsyncAction } from '@/lib/use-async-action';
import { useFocusFirstInvalid } from '@/lib/use-focus-first-invalid';
import { useOnlineStatus } from '@/lib/use-online-status';

const OFFLINE_TEXT = 'Sin conexión: para guardar el producto necesitas internet.';

function titleOf(input: ProductInput): string {
  const name = input.name?.trim() || defaultProductName(input.weightKg);
  return productTitle({ name, brand: input.brand.trim() });
}

type ProductFormPanelProps = {
  distributorId: string;
  /** The product to edit, or null to add a new one. */
  product: Product | null;
  /** Saved: what to tell the owner. */
  onSaved: (message: string) => void;
  onCancel: () => void;
};

/**
 * Add or edit one product (PLAN 3.1). Prices are typed in soles and kept in cents; every refusal
 * of the domain (or of the rules) is painted on its field before anything is written.
 */
export function ProductFormPanel(props: ProductFormPanelProps) {
  const { distributorId, product, onSaved, onCancel } = props;
  const isOnline = useOnlineStatus();
  const { isRunning, run } = useAsyncAction();
  const formRef = useRef<HTMLFormElement>(null);
  const [form, setForm] = useState(() => (product ? productFormOf(product) : emptyProductForm()));
  const [errors, setErrors] = useState<ProductFormErrors>({});
  useFocusFirstInvalid(formRef, errors);
  const isNew = product === null;

  // The form opens where the list was: bring it into view and start at its first field.
  useEffect(() => {
    formRef.current?.scrollIntoView({ block: 'start' });
    formRef.current?.querySelector<HTMLInputElement>('input[name="brand"]')?.focus();
  }, []);

  const set: SetProductField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => {
      const { [field]: _field, form: _form, ...rest } = current;
      return rest;
    });
  };

  const save = (input: ProductInput) =>
    void run(async () => {
      try {
        if (isNew) {
          await addProduct(distributorId, input);
          onSaved(`Añadimos ${titleOf(input)} a tu catálogo.`);
        } else {
          await editProduct(distributorId, product, productPatchOf(input));
          onSaved(`Guardamos los cambios de ${titleOf(input)}.`);
        }
      } catch (error) {
        setErrors(productFormErrorsOf(error));
      }
    });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const read = readProductForm(form);
    if (!read.ok) return setErrors(read.errors);
    if (isOnline) save(read.input);
    return undefined;
  };

  return (
    <form
      ref={formRef}
      noValidate
      onSubmit={submit}
      aria-labelledby="product-form-title"
      className="flex scroll-mt-[calc(var(--top-inset)+1rem)] flex-col gap-7"
    >
      <div>
        <h2 id="product-form-title" className="text-xl font-extrabold">
          {isNew ? 'Nuevo producto.' : `Editar ${productTitle(product)}.`}
        </h2>
        <p className="mt-1 text-muted-foreground">
          {isNew
            ? 'Se pone a la venta apenas lo guardes, al final de tu lista.'
            : 'Los pedidos que ya entraron conservan el precio con el que se hicieron.'}
        </p>
      </div>
      <ProductFields form={form} errors={errors} set={set} fixedWeightKg={product?.weightKg} />
      <FormStatus error={errors.form} isOnline={isOnline} offlineText={OFFLINE_TEXT} />
      <div className="flex flex-wrap gap-3">
        <Button type="submit" loading={isRunning} loadingLabel="Guardando…" disabled={!isOnline}>
          {isNew ? 'Guardar producto' : 'Guardar cambios'}
        </Button>
        <Button type="button" variant="line" disabled={isRunning} onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
