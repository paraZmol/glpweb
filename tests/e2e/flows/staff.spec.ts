import { expect, type Locator, type Page } from '@playwright/test';
import { SEED_DISTRIBUTORS, SEED_INVITE_CODE, SEED_USERS } from '../../seed/data';
import { type Actor, DESKTOP, PHONE, runOncePerActorDevices, test } from '../support/actors';
import {
  createTestAccount,
  readDocument,
  uniqueTag,
  writeDocument,
} from '../support/emulator-admin';
import { type E2eIdentity, signInAs, signInHere } from '../support/sign-in';

test.skip(
  process.env.E2E_EMULATORS !== 'true',
  'Needs the seeded emulators: run with E2E_EMULATORS=true',
);
runOncePerActorDevices();
// Several people, each signing in, some accepting the terms first.
test.slow();

// PLAN 3.2: the staff of a distributor joins by invitation, and its owner manages it.

const STAFF_PATH = '/central/personal';
const A = SEED_DISTRIBUTORS.a;
const DENIED_NOTICE = 'Esa sección no está disponible para tu cuenta. Te llevamos a la tuya.';
const TERMS_BOX = /Acepto los Términos y condiciones/;
const PRIVACY_BOX = /Leí la Política de privacidad/;
const DAY_MS = 24 * 60 * 60 * 1000;

const button = (page: Page | Locator, name: string | RegExp, exact = false) =>
  page.getByRole('button', { name, exact });
const heading = (page: Page) => page.getByRole('heading', { level: 1 });
const linkTo = (code: string, distributorId: string = A.id) =>
  `/unirme#d=${distributorId}&c=${code}`;
/** 20 letters and digits, the shape of a code: unique per test. */
const codeOf = (prefix: string, tag: string) =>
  `${prefix}${tag.replace(/[^A-Za-z0-9]/g, '')}`.padEnd(20, 'x').slice(0, 20);

async function openStaff(owner: Actor) {
  await owner.page.getByRole('link', { name: 'Personal' }).click();
  await expect(owner.page).toHaveURL(new RegExp(`${STAFF_PATH}$`));
  await expect(heading(owner.page)).toHaveText('Tu personal.');
}

/** The owner invites from the screen; returns the path of the link it would send. */
async function invite(owner: Actor, role: 'Titular' | 'Central' | 'Reparto', email = '') {
  const page = owner.page;
  await button(page, 'Invitar a alguien').click();
  await page.getByRole('radio', { name: new RegExp(`^${role}`) }).click();
  if (email) await page.getByLabel(/^Correo de Google/).fill(email);
  await button(page, 'Crear invitación').click();
  await expect(page.getByRole('heading', { name: 'Invitación lista.' })).toBeVisible();
  const link = new URL(await page.getByLabel('Enlace de la invitación').inputValue());
  await button(page, 'Listo').click();
  return `${link.pathname}${link.hash}`;
}

async function acceptTerms(page: Page) {
  await page.getByRole('checkbox', { name: TERMS_BOX }).check();
  await page.getByRole('checkbox', { name: PRIVACY_BOX }).check();
  await button(page, 'Aceptar y continuar').click();
}

test('the owner invites a driver by link; a new person signs in, accepts and joins; switched off, it loses access at once', async ({
  actors,
}, testInfo) => {
  const tag = uniqueTag(testInfo);
  const owner = await actors.openSeed('ownerA');
  await owner.context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await openStaff(owner);

  // No address: any Google account with the link may use it, once, for 7 days.
  await button(owner.page, 'Invitar a alguien').click();
  await expect(
    owner.page.getByText('Recomendado: así solo esa cuenta de Google puede usarla.'),
  ).toBeVisible();
  await button(owner.page, 'Crear invitación').click();
  await expect(owner.page.getByRole('heading', { name: 'Invitación lista.' })).toBeVisible();
  const whatsapp = owner.page.getByRole('link', {
    name: 'Compartir por WhatsApp (se abre en otra pestaña)',
    exact: true,
  });
  const message = new URL((await whatsapp.getAttribute('href')) ?? '').searchParams.get('text');
  await button(owner.page, 'Copiar enlace', true).click();
  await expect(
    owner.page.getByText('Enlace copiado. Pégalo en el chat de la persona.'),
  ).toBeVisible();
  const copied = await owner.page.evaluate(() => navigator.clipboard.readText());
  const link = new URL(copied);
  expect(link.pathname).toBe('/unirme');
  expect(link.search).toBe('');
  expect(link.hash).toMatch(new RegExp(`^#d=${A.id}&c=[A-Za-z0-9]{20}$`));
  expect(message).toContain(`${A.name} te invita a Hornilla como repartidor.`);
  expect(message).toContain(copied);
  await button(owner.page, 'Listo').click();

  // Somebody Hornilla has never seen opens it on a phone, signed out.
  const newcomer: E2eIdentity = {
    email: `invitada-${tag}@example.com`,
    displayName: 'S. Invitada',
  };
  const driver = await actors.open(PHONE);
  await driver.page.goto(`${link.pathname}${link.hash}`);
  await expect(driver.page).toHaveURL(/\/ingresar\?desde=%2Funirme#d=/);
  await expect(
    driver.page.getByText('Ingresa con tu cuenta de Google para ver tu invitación.'),
  ).toBeVisible();
  await signInHere(driver.page, newcomer);
  await expect(driver.page).toHaveURL(/\/aceptar-terminos$/);
  await acceptTerms(driver.page);
  await expect(driver.page).toHaveURL(new RegExp(`/unirme${link.hash.replace(/[&]/g, '\\&')}$`));
  await expect(heading(driver.page)).toHaveText(`${A.name} te invita como repartidor.`);
  // PLAN §11 (2026-10-15): who invites travels with the invitation.
  await expect(driver.page.getByText(SEED_USERS.ownerA.displayName, { exact: true })).toBeVisible();
  await button(driver.page, `Unirme a ${A.name}`).click();
  await expect(driver.page).toHaveURL(/\/reparto$/);
  await expect(driver.page.getByText(`Te uniste a ${A.name} como Reparto.`)).toBeVisible();
  // Nothing of the invitation stays on the device.
  const stored = await driver.page.evaluate(() =>
    JSON.stringify({ ...localStorage, ...sessionStorage }),
  );
  expect(stored).not.toContain(link.hash.slice(-20));

  // The owner sees the person in the staff, and the invitation no longer waits.
  await owner.page.reload();
  const row = owner.page.getByRole('article').filter({ hasText: 'S. Invitada' });
  await expect(row).toContainText('Con acceso');
  expect((await readDocument(`distributors/${A.id}/invites/${link.hash.slice(-20)}`))?.status).toBe(
    'accepted',
  );

  // Switched off: the open session of the driver leaves its panel at once.
  await button(row, 'Desactivar a S. Invitada').click();
  await button(owner.page, 'Sí, desactivar').click();
  await expect(owner.page.getByText(`S. Invitada ya no entra a ${A.name}.`)).toBeVisible();
  await expect(row).toContainText('Sin acceso');
  await expect(driver.page).toHaveURL(/\/inicio$/);
  // It is told why: its access was withdrawn (role walker, fourth pass).
  await expect(
    driver.page.getByText(`Ya no tienes acceso a ${A.name}`, { exact: false }),
  ).toBeVisible();
  expect([...owner.errors, ...driver.errors]).toEqual([]);
});

test('an invitation tied to an address refuses another account and lets that one in as central', async ({
  actors,
}, testInfo) => {
  const tag = uniqueTag(testInfo);
  const invited = await createTestAccount(`${tag}-c`);
  const other = await createTestAccount(`${tag}-o`);
  const owner = await actors.openSeed('ownerA');
  await openStaff(owner);
  const path = await invite(owner, 'Central', invited.email.toUpperCase());
  await expect(
    owner.page.getByRole('article', { name: `Invitación de Central para ${invited.email}` }),
  ).toBeVisible();

  const wrong = await actors.open(DESKTOP);
  await signInAs(wrong.page, other, '/inicio');
  await wrong.page.goto(path);
  await expect(heading(wrong.page)).toHaveText('Esta invitación es para otra cuenta de Google.');
  await expect(
    wrong.page.getByText(`Ahora estás con ${other.email}.`, { exact: false }),
  ).toBeVisible();
  await expect(button(wrong.page, /^Unirme/)).toHaveCount(0);

  const right = await actors.open(DESKTOP);
  await signInAs(right.page, invited, '/inicio');
  await right.page.goto(path);
  await button(right.page, `Unirme a ${A.name}`).click();
  await expect(right.page).toHaveURL(/\/central$/);
  await expect(right.page.getByText(`Te uniste a ${A.name} como Central.`)).toBeVisible();
  // The central does not manage the staff: no link, and the address sends it back.
  await expect(right.page.getByRole('link', { name: 'Personal' })).toHaveCount(0);
  await right.page.goto(STAFF_PATH);
  await expect(right.page).toHaveURL(/\/central$/);
  await expect(right.page.getByText(DENIED_NOTICE)).toBeVisible();
});

test('expired, withdrawn, used and broken invitations say so; a member is told it already is one', async ({
  actors,
}, testInfo) => {
  const tag = uniqueTag(testInfo);
  // The seeded invitation: the first account uses it, the second finds it used.
  const first = await createTestAccount(`${tag}-1`);
  const second = await createTestAccount(`${tag}-2`);
  const firstActor = await actors.open(PHONE);
  await signInAs(firstActor.page, first, '/inicio');
  await firstActor.page.goto(linkTo(SEED_INVITE_CODE));
  await button(firstActor.page, `Unirme a ${A.name}`).click();
  await expect(firstActor.page).toHaveURL(/\/reparto$/);

  const visitor = await actors.open(PHONE);
  await signInAs(visitor.page, second, '/inicio');
  await visitor.page.goto(linkTo(SEED_INVITE_CODE));
  await expect(heading(visitor.page)).toHaveText('Esta invitación ya se usó.');

  // One past its seven days.
  const expired = codeOf('Old', tag);
  const longAgo = new Date(Date.now() - 8 * DAY_MS);
  await writeDocument(`distributors/${A.id}/invites/${expired}`, {
    role: 'driver',
    email: null,
    distributorName: A.name,
    status: 'pending',
    createdBy: SEED_USERS.ownerA.uid,
    createdAt: longAgo,
    updatedAt: longAgo,
  });
  await visitor.page.goto(linkTo(expired));
  await expect(heading(visitor.page)).toHaveText('Esta invitación venció.');

  // Withdrawn by the owner: the link stops working at once.
  const owner = await actors.openSeed('ownerA');
  await openStaff(owner);
  const withdrawn = await invite(owner, 'Reparto', `anulada-${tag}@example.com`);
  const row = owner.page.getByRole('article', {
    name: `Invitación de Reparto para anulada-${tag}@example.com`,
  });
  await button(row, /^Anular/).click();
  await button(owner.page, 'Sí, anular').click();
  await expect(owner.page.getByText('Invitación anulada.')).toBeVisible();
  await expect(row).toHaveCount(0);
  expect((await readDocument(`distributors/${A.id}/invites/${withdrawn.slice(-20)}`))?.status).toBe(
    'revoked',
  );
  await visitor.page.goto(withdrawn);
  await expect(heading(visitor.page)).toHaveText('Esta invitación fue anulada.');

  // A link cut short, and a code nobody created.
  await visitor.page.goto('/unirme#d=seed-dist-a&c=corto');
  await expect(heading(visitor.page)).toHaveText('Este enlace de invitación no está completo.');
  await visitor.page.goto(linkTo(codeOf('Nadie', tag)));
  await expect(heading(visitor.page)).toHaveText('No encontramos esta invitación.');

  // Somebody of the staff opens a fresh one: it is a member already.
  const fresh = await invite(owner, 'Reparto');
  const member = await actors.openSeed('driverA');
  await member.page.goto(fresh);
  await expect(heading(member.page)).toHaveText(`Ya formas parte de ${A.name}.`);
  await button(member.page, 'Ir a mi panel').click();
  await expect(member.page).toHaveURL(/\/reparto$/);
});

test('the founder invites a co-owner by address; a co-owner cannot make anyone an owner', async ({
  actors,
}, testInfo) => {
  const coOwner = await createTestAccount(`${uniqueTag(testInfo)}-t`);
  const founder = await actors.openSeed('ownerA');
  await openStaff(founder);
  // An owner needs the address of its Google account.
  await button(founder.page, 'Invitar a alguien').click();
  await founder.page.getByRole('radio', { name: /^Titular/ }).click();
  await button(founder.page, 'Crear invitación').click();
  await expect(
    founder.page.getByText('Para invitar a un titular escribe su correo de Google.'),
  ).toBeVisible();
  await button(founder.page, 'Cancelar').click();
  const path = await invite(founder, 'Titular', coOwner.email);

  const actor = await actors.open(DESKTOP);
  await signInAs(actor.page, coOwner, '/inicio');
  await actor.page.goto(path);
  await expect(heading(actor.page)).toHaveText(`${A.name} te invita como titular.`);
  await button(actor.page, `Unirme a ${A.name}`).click();
  await expect(actor.page).toHaveURL(/\/central$/);
  await openStaff(actor);

  const page = actor.page;
  await button(page, 'Invitar a alguien').click();
  await expect(page.getByRole('radio', { name: /^Central/ })).toBeVisible();
  await expect(page.getByRole('radio', { name: /^Titular/ })).toHaveCount(0);
  await button(page, 'Cancelar').click();
  const founderRow = page.getByRole('article').filter({ hasText: SEED_USERS.ownerA.displayName });
  await expect(founderRow).toContainText('Registró la distribuidora');
  await expect(founderRow.getByRole('button')).toHaveCount(0);
  await expect(
    page
      .getByRole('article')
      .filter({ hasText: `${coOwner.displayName} (tú)` })
      .getByRole('button'),
  ).toHaveCount(0);
  const driverRow = page.getByRole('article').filter({ hasText: SEED_USERS.driverA.displayName });
  await button(driverRow, /^Cambiar rol/).click();
  await expect(driverRow.getByRole('radio', { name: 'Central' })).toBeVisible();
  await expect(driverRow.getByRole('radio', { name: 'Titular' })).toHaveCount(0);
  await button(driverRow, 'Cancelar').click();
  expect(actor.errors).toEqual([]);
});

test('the owner adds, renames, switches off and on its helpers', async ({ actors }, testInfo) => {
  const name = `T. Ayuda ${testInfo.repeatEachIndex}${uniqueTag(testInfo).slice(-4)}`;
  const owner = await actors.openSeed('ownerA');
  await openStaff(owner);
  const page = owner.page;
  await expect(page.getByRole('heading', { name: 'P. Ayudante' })).toBeVisible();

  await page.getByLabel('Nombre del ayudante').fill(`  ${name}  `);
  await button(page, 'Añadir').click();
  await expect(page.getByText(`Añadimos a ${name}.`)).toBeVisible();
  await button(page, `Renombrar a ${name}`).click();
  await page.getByLabel(`Nuevo nombre de ${name}`).fill(`${name} B`);
  await button(page, 'Guardar nombre').click();
  await expect(page.getByText('Guardamos el nombre.')).toBeVisible();
  const row = page.getByRole('article').filter({ hasText: `${name} B` });
  await button(row, /^Desactivar/).click();
  await expect(row).toContainText('No disponible');
  await button(row, /^Activar/).click();
  await expect(row).toContainText('Disponible');

  // A name with nothing visible is refused with its reason.
  await page.getByLabel('Nombre del ayudante').fill('​');
  await button(page, 'Añadir').click();
  await expect(
    page.getByText('Escribe el nombre con letras o números, sin caracteres invisibles.'),
  ).toBeVisible();
  expect(owner.errors).toEqual([]);
});

test('a read-only distributor shows its staff without a way to change it', async ({ actors }) => {
  const owner = await actors.openSeed('ownerC');
  await openStaff(owner);
  await expect(owner.page.getByText(/Hornilla suspendió tu distribuidora/)).toBeVisible();
  await expect(button(owner.page, 'Invitar a alguien')).toHaveCount(0);
  await expect(owner.page.getByLabel('Nombre del ayudante')).toHaveCount(0);
  await expect(owner.page.getByText('Todavía no tienes ayudantes.')).toBeVisible();
});
