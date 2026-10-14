import { describe, expect, it } from 'vitest';
import { CatalogFullError, StaleCatalogError } from '../../domain/catalog/errors';
import { prepareNewProduct } from '../../domain/catalog/product-input';
import { InvalidInputError, PermissionDeniedError } from '../../domain/tenancy/errors';
import {
  describeCatalogError,
  describeProductIssue,
  productFieldMessagesOf,
} from './catalog-messages';

describe('catalogue messages', () => {
  it('explains why a full cylinder must cost more than a refill', () => {
    expect(describeProductIssue({ field: 'fullPriceCents', code: 'notAbove' })).toBe(
      'El balón completo lleva gas y envase: debe costar más que la recarga.',
    );
  });

  it('falls back to the general message of the code', () => {
    expect(describeProductIssue({ field: 'brandColor', code: 'invalid' })).toBe(
      'Elige un color válido.',
    );
  });

  it('paints every rejected field of the form', () => {
    const prepared = prepareNewProduct({
      brand: '',
      weightKg: 10,
      refillPriceCents: 0,
      fullPriceCents: null,
    });
    const error = new InvalidInputError(prepared.ok ? [] : prepared.issues);
    expect(productFieldMessagesOf(error)).toEqual({
      brand: 'Escribe la marca del gas.',
      refillPriceCents: 'Escribe un precio entre S/ 0.01 y S/ 999.00.',
    });
  });

  it.each([
    [
      new CatalogFullError(30),
      'Puedes tener hasta 30 productos, también los que no están a la venta.',
    ],
    [
      new StaleCatalogError(),
      'Tu catálogo cambió en otra pantalla. Vuelve a cargar la lista e inténtalo de nuevo.',
    ],
    [
      new PermissionDeniedError(),
      'No tienes permiso para hacer esto, o la distribuidora está en solo lectura.',
    ],
  ])('says what went wrong: %s', (error, message) => {
    expect(describeCatalogError(error)).toBe(message);
  });
});
