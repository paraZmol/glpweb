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

/** PLAN 2.11: a visitor is told the same as for a link nobody has. */
const NOT_FOUND = 'Esta distribuidora no existe.';
const READ_ONLY =
  'Tu distribuidora está en solo lectura: puedes ver todo, pero no registrar cambios hasta regularizar el plan.';
/** A suspension is told apart: the plan does not fix it, and it says where to ask. */
const SUSPENDED =
  'Hornilla suspendió tu distribuidora: está en solo lectura y no aparece en el buscador ni en tu enlace.';
/** Words that would tell a visitor why: the plan of a distributor is nobody else's business. */
const REASONS =
  /suspendid|prueba (terminada|gratis|vencida)|pago pendiente|plan activo|solo lectura/i;

/** Everything the page of a visitor says. */
const saidOn = (page: Page) => page.locator('body').innerText();

/** The visitor learns nothing: not that it exists, not its name, not its phone, not why. */
async function expectHiddenFrom(page: Page, distributor: { name: string; contactPhone: string }) {
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(NOT_FOUND);
  const said = await saidOn(page);
  expect(said).not.toContain(distributor.name);
  expect(said).not.toContain(distributor.contactPhone);
  expect(said).not.toMatch(REASONS);
}

// PLAN 2.3, 2.5, 2.6, 2.9, 2.11: a distributor that may not operate, seen by a customer and by
// its owner at the same time. The customer does not even learn that it exists.
const STOPPED = [
  { owner: 'ownerC', distributor: SEED_DISTRIBUTORS.c, chip: 'Suspendida', notice: SUSPENDED },
  {
    owner: 'ownerD',
    distributor: SEED_DISTRIBUTORS.d,
    chip: 'Prueba terminada',
    notice: READ_ONLY,
  },
] as const;

for (const { owner, distributor, chip, notice } of STOPPED) {
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

    await expectHiddenFrom(customer.page, distributor);

    // Its owner opens the office meanwhile.
    const office = await actors.openSeed(owner);

    await expect(office.page.getByRole('heading', { level: 1 })).toHaveText(
      `Hoy en ${distributor.name}.`,
    );
    await expect(office.page.getByText(notice)).toBeVisible();
    await expect(office.page.getByText(chip, { exact: true })).toBeVisible();

    // The owner coming in changed nothing for the customer, on the page or in the finder.
    await customer.page.reload();
    await expectHiddenFrom(customer.page, distributor);
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

// PLAN 2.11: founded and waiting for the review of the platform.
test('a distributor that waits for its review is hidden from customers and open to its owner', async ({
  actors,
}) => {
  const distributor = SEED_DISTRIBUTORS.e;
  const customer = await actors.open(PHONE);
  await customer.context.grantPermissions(['geolocation']);
  await customer.context.setGeolocation({
    latitude: distributor.plant.lat,
    longitude: distributor.plant.lng,
  });

  await customer.page.goto(`/d/${distributor.slug}`);
  await expectHiddenFrom(customer.page, distributor);
  await customer.page.goto('/');
  await customer.page.getByRole('button', { name: 'Usar mi ubicación' }).click();
  await expect(
    customer.page.getByRole('heading', { name: 'Todavía no hay distribuidoras en tu zona.' }),
  ).toBeVisible();

  // Its owner works in it meanwhile, and sees its own page.
  const office = await actors.openSeed('ownerE');
  await expect(office.page.getByRole('heading', { level: 1 })).toHaveText(
    `Hoy en ${distributor.name}.`,
  );
  await office.page.goto(`/d/${distributor.slug}`);
  await expect(office.page.getByRole('heading', { level: 1 })).toHaveText(distributor.name);

  expect(await readDocument(`distributors/${distributor.id}/private/control`)).toMatchObject({
    listingApproved: false,
  });
  expect(await readDocument(`distributors/${distributor.id}`)).toMatchObject({
    acceptingOrders: false,
  });
  expect([...customer.errors, ...office.errors]).toEqual([]);
});
