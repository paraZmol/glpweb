import { expect, type Page } from '@playwright/test';
import { SEED_DISTRIBUTORS } from '../../seed/data';
import { PHONE, runOncePerActorDevices, test } from '../support/actors';
import { readDocument } from '../support/emulator-admin';

test.skip(
  process.env.E2E_EMULATORS !== 'true',
  'Needs the seeded emulators: run with E2E_EMULATORS=true',
);
runOncePerActorDevices();
// Every actor opens a context of its own, which loads the app cold (nothing cached): with
// all the workers doing the same, two actors do not fit in the budget of one screen.
test.slow();

const NOT_TAKING_ORDERS = 'Esta distribuidora no está recibiendo pedidos por ahora.';
const READ_ONLY =
  'Tu distribuidora está en solo lectura: puedes ver todo, pero no registrar cambios hasta regularizar el plan.';
/** Words that would tell a visitor why: the plan of a distributor is nobody else's business. */
const REASONS =
  /suspendid|prueba (terminada|gratis|vencida)|pago pendiente|plan activo|solo lectura/i;

/** Everything the page says, without the name of the distributor (the seeded names describe it). */
async function saidApartFromName(page: Page, name: string): Promise<string> {
  return (await page.locator('body').innerText()).replaceAll(name, '');
}

// PLAN 2.3, 2.5, 2.6, 2.9: a distributor that may not operate, seen by a customer and by its
// owner at the same time. The customer learns that it takes no orders, never why.
const STOPPED = [
  { owner: 'ownerC', distributor: SEED_DISTRIBUTORS.c, chip: 'Suspendida' },
  { owner: 'ownerD', distributor: SEED_DISTRIBUTORS.d, chip: 'Prueba terminada' },
] as const;

for (const { owner, distributor, chip } of STOPPED) {
  test(`${distributor.name}: closed to customers without a reason, read-only for its owner`, async ({
    actors,
  }) => {
    const customer = await actors.open(PHONE);
    await customer.context.grantPermissions(['geolocation']);
    // Standing at the door of its plant: if it were listed anywhere, it would be here.
    await customer.context.setGeolocation({
      latitude: distributor.plant.lat,
      longitude: distributor.plant.lng,
    });

    await customer.page.goto(`/d/${distributor.slug}`);

    await expect(customer.page.getByRole('heading', { level: 1 })).toHaveText(distributor.name);
    await expect(customer.page.getByText(NOT_TAKING_ORDERS)).toBeVisible();
    expect(await saidApartFromName(customer.page, distributor.name)).not.toMatch(REASONS);

    // Its owner opens the office meanwhile.
    const office = await actors.openSeed(owner);

    await expect(office.page.getByRole('heading', { level: 1 })).toHaveText(
      `Hoy en ${distributor.name}.`,
    );
    await expect(office.page.getByText(READ_ONLY)).toBeVisible();
    await expect(office.page.getByText(chip, { exact: true })).toBeVisible();

    // The owner coming in changed nothing for the customer, on the page or in the finder.
    await customer.page.reload();
    await expect(customer.page.getByText(NOT_TAKING_ORDERS)).toBeVisible();
    expect(await saidApartFromName(customer.page, distributor.name)).not.toMatch(REASONS);
    await customer.page.goto('/');
    await customer.page.getByRole('button', { name: 'Usar mi ubicación' }).click();
    await expect(
      customer.page.getByRole('heading', { name: 'Todavía no hay distribuidoras en tu zona.' }),
    ).toBeVisible();
    await expect(customer.page.getByText(distributor.name)).toHaveCount(0);
    // The screens agree with the database.
    expect(await readDocument(`distributors/${distributor.id}`)).toMatchObject({
      acceptingOrders: false,
    });
    expect([...customer.errors, ...office.errors]).toEqual([]);
  });
}
