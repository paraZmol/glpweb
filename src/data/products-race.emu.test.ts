// PLAN §11, 2026-10-16: two catalogue writes at the same time must leave the copy in the
// profile ("Recarga N kg desde") as the catalogue they leave together. Each test holds the first
// write at the door of its transaction until the second one has committed: before the fix, the
// first write computed the copy from a catalogue it had read before that door.
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { SEED_DISTRIBUTORS, SEED_USERS } from '../../tests/seed/data';
import { seedEmulators } from '../../tests/seed/seed';
import { signInAs } from '../../tests/support/emulated-session';
import type { NewProduct } from '../domain/catalog/product';
import { signOutSession } from './auth-repo';
import { getDistributor } from './distributors-repo';
import { createProduct, updateProduct } from './products-repo';

const gate = vi.hoisted(() => ({ hold: null as Promise<void> | null, reached: () => {} }));

vi.mock('firebase/firestore', async (importOriginal) => {
  const firestore = await importOriginal<typeof import('firebase/firestore')>();
  return {
    ...firestore,
    runTransaction: async (...args: Parameters<typeof firestore.runTransaction>) => {
      const hold = gate.hold;
      if (hold) {
        gate.hold = null;
        gate.reached();
        await hold;
      }
      return firestore.runTransaction(...args);
    },
  };
});

const { a: A } = SEED_DISTRIBUTORS;

/** Holds the next transaction until `release` is called; `reached` resolves when it waits. */
function holdNextTransaction() {
  let release = () => {};
  const reached = new Promise<void>((resolve) => {
    gate.reached = resolve;
  });
  gate.hold = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { reached, release };
}

async function summaryOf(d: string) {
  const profile = await getDistributor(d);
  return { priceFromCents: profile?.priceFromCents, priceFromWeightKg: profile?.priceFromWeightKg };
}

beforeEach(async () => {
  await signOutSession();
  await seedEmulators();
  await signInAs(SEED_USERS.ownerA);
});

afterAll(async () => {
  gate.hold = null;
  await signOutSession();
});

describe('two catalogue writes at the same time', () => {
  it('takes the cheapest refill off sale while another tab raises the next one', async () => {
    const { reached, release } = holdNextTransaction();
    const offSale = updateProduct(A.id, 'p02', { active: false });
    await reached;

    await updateProduct(A.id, 'p00', { refillPriceCents: 5300 });
    release();
    await offSale;

    // On sale: p00 10 kg at 53.00, p01 10 kg at 52.00, p03 45 kg at 190.00.
    expect(await summaryOf(A.id)).toEqual({ priceFromCents: 5200, priceFromWeightKg: 10 });
  });

  it('edits a product while another tab adds a cheaper one', async () => {
    const cheaper: NewProduct = {
      brand: 'Marca Uno',
      brandColor: null,
      weightKg: 3,
      name: 'Balón 3 kg',
      refillPriceCents: 2500,
      fullPriceCents: null,
      active: true,
    };
    const { reached, release } = holdNextTransaction();
    const edit = updateProduct(A.id, 'p01', { refillPriceCents: 5100 });
    await reached;

    await createProduct(A.id, cheaper);
    release();
    await edit;

    expect(await summaryOf(A.id)).toEqual({ priceFromCents: 2500, priceFromWeightKg: 3 });
  });
});
