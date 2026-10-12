import { expect, type Locator, type Page } from '@playwright/test';
import { type Actors, DESKTOP, runOncePerActorDevices, test } from '../support/actors';
import { createTestAccount, readDocument, uniqueTag } from '../support/emulator-admin';
import {
  CREATE_BUTTON,
  fillFoundingWizard,
  foundDistributor,
  FOUNDING_AUTHORITY_BOX,
  FOUNDING_PATH,
  FOUNDING_PLANT,
  FOUNDING_TERMS_BOX,
} from '../support/founding';
import { signInWithPassword } from '../support/sign-in';

test.skip(
  process.env.E2E_EMULATORS !== 'true',
  'Needs the seeded emulators: run with E2E_EMULATORS=true',
);
runOncePerActorDevices();

const LINK_TAKEN = 'Ese enlace ya lo usa otra distribuidora.';
const CAP_REACHED = 'Una cuenta puede registrar hasta 3 distribuidoras.';
const OFFICE = /\/central$/;
const MAX_DISTRIBUTORS = 3;

type Outcome = 'founded' | 'refused';

const create = (page: Page) => page.getByRole('button', { name: CREATE_BUTTON }).click();

/** How the sign-up of this tab ended: on the office of the new distributor, or told why not. */
function outcomeOf(page: Page, refusal: Locator): Promise<Outcome> {
  return Promise.race([
    page.waitForURL(OFFICE).then((): Outcome => 'founded'),
    refusal.waitFor().then((): Outcome => 'refused'),
  ]);
}

/** Splits two tabs that raced into the one that founded and the one that was refused. */
function winnerAndLoser<Racer>(racers: [Racer, Racer], outcomes: [Outcome, Outcome]) {
  expect([...outcomes].sort(), 'exactly one of the two founds').toEqual(['founded', 'refused']);
  const [first, second] = racers;
  return outcomes[0] === 'founded'
    ? { winner: first, loser: second }
    : { winner: second, loser: first };
}

// PLAN 2.2: the link is unique. Two accounts ask for the same one at the same moment.
test('two accounts send the same link at once: one founds, the other keeps its form', async ({
  actors,
}, testInfo) => {
  // Two whole sign-ups side by side, and a third one after the race.
  test.slow();
  const tag = uniqueTag(testInfo);
  const slug = `carrera-${tag}`;
  const racers = await Promise.all(
    (['uno', 'dos'] as const).map(async (ordinal) => {
      const account = await createTestAccount(`${tag}-${ordinal}`);
      const actor = await actors.open(DESKTOP);
      await signInWithPassword(actor.page, account.email, '/inicio');
      await actor.page.goto(FOUNDING_PATH);
      const name = `Gas Carrera ${ordinal} ${tag}`;
      await fillFoundingWizard(actor.page, { name, slug });
      return { ...actor, account, name };
    }),
  );
  const [one, two] = racers as [(typeof racers)[number], (typeof racers)[number]];

  const [, , ...outcomes] = await Promise.all([
    create(one.page),
    create(two.page),
    outcomeOf(one.page, one.page.getByText(LINK_TAKEN)),
    outcomeOf(two.page, two.page.getByText(LINK_TAKEN)),
  ]);

  const { winner, loser } = winnerAndLoser([one, two], outcomes as [Outcome, Outcome]);
  await expect(winner.page.getByRole('heading', { level: 1 })).toHaveText(`Hoy en ${winner.name}.`);
  // The loser is taken back to the step of the link, with everything it typed still there.
  await expect(loser.page).toHaveURL(new RegExp(`${FOUNDING_PATH}$`));
  await expect(loser.page.getByLabel('Enlace de tu página')).toHaveValue(slug);
  await expect(loser.page.getByLabel('Nombre de la distribuidora')).toHaveValue(loser.name);
  // The database agrees with the screens: the link belongs to the winner, and only to it.
  const link = await readDocument(`slugs/${slug}`);
  const control = await readDocument(`distributors/${String(link?.distributorId)}/private/control`);
  expect(control?.ownerUid).toBe(winner.account.uid);
  expect(await readDocument(`distributors/${String(link?.distributorId)}`)).toMatchObject({
    name: winner.name,
    slug,
  });
  const profileOf = (uid: string) => readDocument(`users/${uid}`);
  expect((await profileOf(winner.account.uid))?.ownedDistributorIds).toEqual([link?.distributorId]);
  expect((await profileOf(loser.account.uid))?.ownedDistributorIds).toEqual([]);

  // Nothing typed was lost: with another link the loser founds without filling anything again.
  const { page } = loser;
  const stepHeading = page.getByRole('heading', { level: 1 });
  const next = page.getByRole('button', { name: 'Continuar' });
  await page.getByLabel('Enlace de tu página').fill(`${slug}-b`);
  await expect(page.getByText('Está libre.')).toBeVisible();
  await next.click();
  await expect(stepHeading).toContainText('tu planta.');
  await expect(page.getByLabel('Latitud')).toHaveValue(FOUNDING_PLANT.latitude);
  await expect(page.getByLabel(/Dirección de la planta/)).toHaveValue(FOUNDING_PLANT.address);
  await next.click();
  await expect(stepHeading).toContainText('tu color.');
  await next.click();
  await expect(stepHeading).toContainText('crea tu distribuidora.');
  await expect(page.getByRole('checkbox', { name: FOUNDING_TERMS_BOX })).toBeChecked();
  await expect(page.getByRole('checkbox', { name: FOUNDING_AUTHORITY_BOX })).toBeChecked();
  await create(page);
  await expect(page).toHaveURL(OFFICE);
  await expect(stepHeading).toHaveText(`Hoy en ${loser.name}.`);
  expect([...one.errors, ...two.errors]).toEqual([]);
});

/** An account that already founded two, with one more sign-up ready to send in each of two tabs. */
async function twoTabsOneSlotLeft(actors: Actors, tag: string) {
  const account = await createTestAccount(tag);
  const { context, page: firstTab, errors } = await actors.open(DESKTOP);
  await signInWithPassword(firstTab, account.email, '/inicio');
  await foundDistributor(firstTab, { name: `Gas Tope uno ${tag}`, slug: `tope-uno-${tag}` });
  await foundDistributor(firstTab, { name: `Gas Tope dos ${tag}`, slug: `tope-dos-${tag}` });
  const secondTab = await context.newPage();
  await firstTab.goto(FOUNDING_PATH);
  await secondTab.goto(FOUNDING_PATH);
  const slugs: [string, string] = [`tope-tres-${tag}`, `tope-cuatro-${tag}`];
  await fillFoundingWizard(firstTab, { name: `Gas Tope tres ${tag}`, slug: slugs[0] });
  await fillFoundingWizard(secondTab, { name: `Gas Tope cuatro ${tag}`, slug: slugs[1] });
  const tabs: [Page, Page] = [firstTab, secondTab];
  return { account, tabs, slugs, errors };
}

// The cap of PLAN §11 under a race: the same account, two tabs, the third and a fourth at once.
test('an account with two distributors sends two more at once: only one is founded', async ({
  actors,
}, testInfo) => {
  test.slow();
  const { account, tabs, slugs, errors } = await twoTabsOneSlotLeft(actors, uniqueTag(testInfo));
  const [firstTab, secondTab] = tabs;

  const [, , ...outcomes] = await Promise.all([
    create(firstTab),
    create(secondTab),
    outcomeOf(firstTab, firstTab.getByRole('alert')),
    outcomeOf(secondTab, secondTab.getByRole('alert')),
  ]);

  const raced = winnerAndLoser(
    [
      { tab: firstTab, slug: slugs[0] },
      { tab: secondTab, slug: slugs[1] },
    ],
    outcomes as [Outcome, Outcome],
  );
  const profile = await readDocument(`users/${account.uid}`);
  expect(profile?.ownedDistributorIds).toHaveLength(MAX_DISTRIBUTORS);
  expect(await readDocument(`slugs/${raced.winner.slug}`)).not.toBeNull();
  expect(await readDocument(`slugs/${raced.loser.slug}`)).toBeNull();
  // The tab that lost stays on its form; opening the sign-up again shows the cap.
  await expect(raced.loser.tab).toHaveURL(new RegExp(`${FOUNDING_PATH}$`));
  await raced.loser.tab.goto(FOUNDING_PATH);
  await expect(
    raced.loser.tab.getByRole('heading', {
      name: `Ya registraste ${MAX_DISTRIBUTORS} distribuidoras.`,
    }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

// The defect flow-tester reported on 2026-10-10 (the loser was told "No tienes permiso para
// hacer esto…") is FIXED in the data layer on 2026-10-11: `createDistributor` now recognises
// that the account reached the cap meanwhile and throws `DistributorLimitError`
// ("tells the loser of a race for the last slot…" in src/data/distributors-repo.emu.test.ts).
test('the tab that loses the race for the last slot is told about the cap', async ({
  actors,
}, testInfo) => {
  test.slow();
  const { tabs } = await twoTabsOneSlotLeft(actors, uniqueTag(testInfo));
  const [firstTab, secondTab] = tabs;

  const [, , ...outcomes] = await Promise.all([
    create(firstTab),
    create(secondTab),
    outcomeOf(firstTab, firstTab.getByText(CAP_REACHED)),
    outcomeOf(secondTab, secondTab.getByText(CAP_REACHED)),
  ]);

  expect([...outcomes].sort()).toEqual(['founded', 'refused']);
});
