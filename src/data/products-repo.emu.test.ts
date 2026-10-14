// PLAN 3.1: the catalogue against the emulators, through the repository the screens use.
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { SEED_DISTRIBUTORS, SEED_USERS } from '../../tests/seed/data';
import { seedEmulators } from '../../tests/seed/seed';
import { signInAs } from '../../tests/support/emulated-session';
import { moveInCatalog, PRODUCT_SLOT_IDS } from '../domain/catalog/catalog';
import {
  CatalogFullError,
  ProductNotFoundError,
  StaleCatalogError,
} from '../domain/catalog/errors';
import type { NewProduct } from '../domain/catalog/product';
import { PermissionDeniedError } from '../domain/tenancy/errors';
import { signOutSession } from './auth-repo';
import { getDistributor } from './distributors-repo';
import {
  createProduct,
  listCatalog,
  listPublicCatalog,
  reorderProducts,
  updateProduct,
} from './products-repo';

const { a: A, b: B, c: SUSPENDED, e: PENDING } = SEED_DISTRIBUTORS;

const NEW_PRODUCT: NewProduct = {
  brand: 'Marca Cuatro',
  brandColor: null,
  weightKg: 10,
  name: 'Balón 10 kg',
  refillPriceCents: 5000,
  fullPriceCents: 18000,
  active: true,
};

const idsOf = (products: { id: string }[]) => products.map((product) => product.id);

async function summaryOf(d: string) {
  const profile = await getDistributor(d);
  return { brands: profile?.brands, priceFromCents: profile?.priceFromCents };
}

beforeEach(async () => {
  await signOutSession();
  await seedEmulators();
});

afterAll(async () => {
  await signOutSession();
});

describe('listPublicCatalog', () => {
  it('gives a visitor the products on sale, in the order of the distributor', async () => {
    const catalog = await listPublicCatalog(A.id);

    expect(idsOf(catalog)).toEqual(['p00', 'p01', 'p02', 'p03']);
    expect(catalog[0]).toMatchObject({
      brand: 'Marca Uno',
      weightKg: 10,
      refillPriceCents: 4800,
      fullPriceCents: 17500,
      currency: 'PEN',
      active: true,
    });
  });

  it('refuses a visitor the catalogue of a suspended distributor', async () => {
    await expect(listPublicCatalog(SUSPENDED.id)).rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it('gives its own staff the products on sale while the listing waits for review', async () => {
    await signInAs(SEED_USERS.ownerE);

    expect(await listPublicCatalog(PENDING.id)).toEqual([]);
  });
});

describe('listCatalog', () => {
  it.each([SEED_USERS.driverA, SEED_USERS.dispatcherA, SEED_USERS.ownerA])(
    'gives the staff every product, the one off sale included ($displayName)',
    async (user) => {
      await signInAs(user);

      expect(idsOf(await listCatalog(A.id))).toEqual(['p00', 'p01', 'p02', 'p03', 'p04']);
    },
  );

  it.each([SEED_USERS.customer, SEED_USERS.ownerB])(
    'refuses the whole catalogue of A to $displayName',
    async (user) => {
      await signInAs(user);

      await expect(listCatalog(A.id)).rejects.toBeInstanceOf(PermissionDeniedError);
    },
  );
});

describe('createProduct', () => {
  it('adds it in the first free slot, last in the list, in the currency of the distributor', async () => {
    await signInAs(SEED_USERS.ownerA);

    const id = await createProduct(A.id, NEW_PRODUCT);

    expect(id).toBe('p05');
    const added = (await listCatalog(A.id)).find((product) => product.id === id);
    expect(added).toMatchObject({ ...NEW_PRODUCT, currency: 'PEN', sortOrder: 5 });
  });

  it('adds the new brand to the profile, and the cheaper refill as "desde"', async () => {
    await signInAs(SEED_USERS.ownerA);

    await createProduct(A.id, { ...NEW_PRODUCT, refillPriceCents: 3500, fullPriceCents: null });

    expect(await summaryOf(A.id)).toEqual({
      brands: ['Marca Uno', 'Marca Dos', 'Marca Cuatro'],
      priceFromCents: 3500,
    });
  });

  it('leaves the profile untouched when its summary does not change', async () => {
    await signInAs(SEED_USERS.ownerA);
    const before = await getDistributor(A.id);

    await createProduct(A.id, { ...NEW_PRODUCT, brand: 'Marca Uno' });

    expect((await getDistributor(A.id))?.updatedAt).toEqual(before?.updatedAt);
  });

  it('refuses the product once the thirty slots are taken', async () => {
    await signInAs(SEED_USERS.ownerB);
    const free = PRODUCT_SLOT_IDS.length - B.products.length;
    for (let added = 0; added < free; added += 1) {
      await createProduct(B.id, { ...NEW_PRODUCT, active: false });
    }

    await expect(createProduct(B.id, NEW_PRODUCT)).rejects.toBeInstanceOf(CatalogFullError);
    expect(await listCatalog(B.id)).toHaveLength(PRODUCT_SLOT_IDS.length);
  });

  it('refuses a product in a suspended distributor', async () => {
    await signInAs(SEED_USERS.ownerC);

    await expect(createProduct(SUSPENDED.id, NEW_PRODUCT)).rejects.toBeInstanceOf(
      PermissionDeniedError,
    );
  });

  it.each([SEED_USERS.dispatcherA, SEED_USERS.driverA])(
    'refuses a product from $displayName: prices are for the owner',
    async (user) => {
      await signInAs(user);

      await expect(createProduct(A.id, NEW_PRODUCT)).rejects.toBeInstanceOf(PermissionDeniedError);
    },
  );
});

describe('updateProduct', () => {
  it('changes the prices', async () => {
    await signInAs(SEED_USERS.ownerA);

    await updateProduct(A.id, 'p00', { refillPriceCents: 4900, fullPriceCents: 17900 });

    const [first] = await listCatalog(A.id);
    expect(first).toMatchObject({ refillPriceCents: 4900, fullPriceCents: 17900 });
  });

  it('takes the cheapest product off sale and moves "desde" to the next one', async () => {
    await signInAs(SEED_USERS.ownerA);

    await updateProduct(A.id, 'p02', { active: false });

    expect(idsOf(await listPublicCatalog(A.id))).toEqual(['p00', 'p01', 'p03']);
    expect(await summaryOf(A.id)).toEqual({
      brands: ['Marca Uno', 'Marca Dos'],
      priceFromCents: 4800,
    });
  });

  it('leaves the profile with no brand and no "desde" when nothing is on sale', async () => {
    await signInAs(SEED_USERS.ownerB);

    await updateProduct(B.id, 'p00', { active: false });
    await updateProduct(B.id, 'p01', { active: false });

    expect(await summaryOf(B.id)).toEqual({ brands: [], priceFromCents: null });
  });

  it('refuses a full cylinder at the price of the refill', async () => {
    await signInAs(SEED_USERS.ownerA);

    await expect(updateProduct(A.id, 'p00', { fullPriceCents: 4800 })).rejects.toBeInstanceOf(
      PermissionDeniedError,
    );
  });

  it('says when the product does not exist', async () => {
    await signInAs(SEED_USERS.ownerA);

    await expect(updateProduct(A.id, 'p20', { active: false })).rejects.toBeInstanceOf(
      ProductNotFoundError,
    );
  });
});

describe('reorderProducts', () => {
  it('moves a product and writes the new order', async () => {
    await signInAs(SEED_USERS.ownerA);
    const catalog = await listCatalog(A.id);

    await reorderProducts(A.id, moveInCatalog(catalog, 'p03', 0));

    const reordered = await listCatalog(A.id);
    expect(idsOf(reordered)).toEqual(['p03', 'p00', 'p01', 'p02', 'p04']);
    expect(reordered.map((product) => product.sortOrder)).toEqual([0, 1, 2, 3, 4]);
  });

  it('follows the new order in the brands of the profile', async () => {
    await signInAs(SEED_USERS.ownerA);
    const catalog = await listCatalog(A.id);

    await reorderProducts(A.id, moveInCatalog(catalog, 'p01', 0));

    expect((await summaryOf(A.id)).brands).toEqual(['Marca Dos', 'Marca Uno']);
  });

  it('refuses an order that does not name every product', async () => {
    await signInAs(SEED_USERS.ownerA);

    await expect(reorderProducts(A.id, ['p01', 'p00'])).rejects.toBeInstanceOf(StaleCatalogError);
  });

  it('refuses a reorder from the dispatcher', async () => {
    await signInAs(SEED_USERS.dispatcherA);

    await expect(reorderProducts(A.id, ['p04', 'p03', 'p02', 'p01', 'p00'])).rejects.toBeInstanceOf(
      PermissionDeniedError,
    );
  });
});
