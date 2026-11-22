import { describe, expect, it } from 'vitest';
import { CatalogFullError } from '../../domain/catalog/errors';
import type { Product } from '../../domain/catalog/product';
import { prepareNewProduct, prepareProductEdit } from '../../domain/catalog/product-input';
import { InvalidInputError, NothingChangedError } from '../../domain/tenancy/errors';
import {
  centsToInput,
  emptyProductForm,
  type ProductForm,
  productFormErrorsOf,
  productFormOf,
  productPatchOf,
  readProductForm,
} from './product-form';

const PRODUCT: Product = {
  id: 'p00',
  brand: 'Marca Uno',
  brandColor: '#1757d6',
  weightKg: 10,
  name: 'Balón 10 kg',
  refillPriceCents: 4800,
  fullPriceCents: 17500,
  currency: 'PEN',
  active: true,
  sortOrder: 0,
  createdAt: new Date('2026-10-14T15:00:00Z'),
  updatedAt: new Date('2026-10-14T15:00:00Z'),
};

const typed = (patch: Partial<ProductForm>): ProductForm => ({
  ...emptyProductForm(),
  brand: 'Marca Uno',
  refillPrice: '48',
  ...patch,
});

// PLAN 3.1: the owner types prices in soles; the catalogue keeps integer cents.
describe('product form', () => {
  it.each([
    ['38', 3800],
    ['38.5', 3850],
    ['38,50', 3850],
    ['S/ 38.00', 3800],
  ])('reads the refill price "%s" as %i cents', (text, cents) => {
    const read = readProductForm(typed({ refillPrice: text }));

    expect(read.ok && read.input.refillPriceCents).toBe(cents);
  });

  it('sells only the refill unless the box is ticked, whatever the full price field says', () => {
    const read = readProductForm(typed({ sellsFull: false, fullPrice: '175' }));

    expect(read.ok && read.input.fullPriceCents).toBeNull();
  });

  it('asks for the full price when the box is ticked and the field is empty', () => {
    expect(readProductForm(typed({ sellsFull: true, fullPrice: ' ' }))).toEqual({
      ok: false,
      errors: { fullPrice: 'Escribe el precio del balón completo, o desmarca la casilla.' },
    });
  });

  it.each([
    ['refillPrice', { refillPrice: '38.555' }],
    ['refillPrice', { refillPrice: 'treinta' }],
    ['fullPrice', { sellsFull: true, fullPrice: '-5' }],
  ] as const)('refuses a price that is not soles, on its own field (%s)', (field, patch) => {
    const read = readProductForm(typed(patch));

    expect(read).toEqual({
      ok: false,
      errors: { [field]: 'Escribe el precio en soles, por ejemplo 52.00.' },
    });
  });

  it.each(['10.5', '', 'diez'])('refuses the weight "%s"', (weightKg) => {
    const read = readProductForm(typed({ weightKg }));

    expect(read.ok ? null : read.errors.weightKg).toBe(
      'Escribe el peso en kilos enteros, por ejemplo 10.',
    );
  });

  it('turns an existing product into its form and back without changing anything', () => {
    const form = productFormOf(PRODUCT);
    const read = readProductForm(form);

    expect(form).toMatchObject({ refillPrice: '48.00', fullPrice: '175.00', sellsFull: true });
    expect(read.ok && prepareProductEdit(PRODUCT, productPatchOf(read.input))).toEqual({
      ok: true,
      value: {},
    });
  });

  it('gives a blank name back the default one when editing', () => {
    const read = readProductForm({ ...productFormOf(PRODUCT), name: '  ' });

    expect(read.ok && productPatchOf(read.input).name).toBe('Balón 10 kg');
  });

  it.each([
    [5, '0.05'],
    [5250, '52.50'],
    [99900, '999.00'],
  ])('writes %i cents in the field as %s', (cents, text) => {
    expect(centsToInput(cents)).toBe(text);
  });
});

describe('errors of the product form', () => {
  it('paints the refusals of the domain on the fields of the form', () => {
    const prepared = prepareNewProduct({
      brand: '',
      weightKg: 10,
      refillPriceCents: 5000,
      fullPriceCents: 5000,
    });
    const error = new InvalidInputError(prepared.ok ? [] : prepared.issues);

    expect(productFormErrorsOf(error)).toEqual({
      brand: 'Escribe la marca del gas.',
      fullPrice: 'El balón completo lleva gas y envase: debe costar más que la recarga.',
    });
  });

  it.each([
    [new NothingChangedError(), 'No cambiaste nada.'],
    [
      new CatalogFullError(30),
      'Puedes tener hasta 30 productos, también los que no están a la venta.',
    ],
  ])('says the rest for the whole form: %s', (error, message) => {
    expect(productFormErrorsOf(error)).toEqual({ form: message });
  });
});
