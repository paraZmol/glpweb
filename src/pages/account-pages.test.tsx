import { describe, expect, it } from 'vitest';
import {
  accountOf,
  memberOf,
  PROFILE,
  SESSION,
  workingAs,
} from '../../tests/support/account-fixtures';
import { count, renderStatic, tags, textOf } from '../../tests/support/render-static';
import { AppShell } from '../components/layout/app-shell';
import { GateShell } from '../components/layout/gate-shell';
import type { AppArea } from '../domain/auth/access';
import { AREA_HOME, JUST_FOUNDED_STATE, ROUTES } from '../lib/routes';
import { AcceptTermsPage } from './account/accept-terms';
import { VerifyEmailPage } from './account/verify-email';
import { AccountPage } from './customer/account';
import { CustomerHomePage } from './customer/home';
import { CustomerOrdersPage } from './customer/orders';
import { DriverHomePage } from './driver/home';
import { OfficeHomePage } from './office/home';
import { PlatformHomePage } from './platform/home';
import { JUST_REGISTERED } from './public/register';

const reload = () => {};
const OWNER = accountOf({ current: workingAs([memberOf('owner')]) });
const DRIVER = accountOf({ current: workingAs([memberOf('driver')]) });

function inArea(
  area: AppArea,
  page: React.ReactElement,
  account = accountOf(),
  path = AREA_HOME[area],
) {
  return renderStatic(page, { path, shell: <AppShell area={area} />, account });
}

const inGate = (page: React.ReactElement, path: string, account = accountOf()) =>
  renderStatic(page, { path, shell: <GateShell />, account });

describe('pending steps of an account (PLAN 2.1, 2.7)', () => {
  it('asks a new Google account for the terms, with the box unticked', () => {
    const fresh = accountOf({
      profile: { status: 'ready', data: { profile: null, needsTermsAcceptance: true }, reload },
    });
    const html = inGate(<AcceptTermsPage />, ROUTES.acceptTerms, fresh);
    const boxes = tags(html, 'input');

    expect(textOf(html)).toContain('Un paso antes de empezar.');
    expect(boxes.map((box) => /name="([^"]+)"/.exec(box)?.[1])).toEqual([
      'acceptTerms',
      'acceptPrivacy',
    ]);
    expect(boxes.every((box) => box.includes('type="checkbox"'))).toBe(true);
    expect(boxes.some((box) => box.includes(' checked=""'))).toBe(false);
    expect(textOf(html)).toContain('Aceptar y continuar');
    expect(textOf(html)).toContain('Cerrar sesión');
  });

  // PLAN 2.9
  it('sums up the terms in four sentences and offers the way out of deleting the account', () => {
    const text = textOf(inGate(<AcceptTermsPage />, ROUTES.acceptTerms));

    expect(text).toContain(
      'Pagas directamente a la distribuidora al recibir. Hornilla no cobra tus pedidos ni guarda tu dinero.',
    );
    expect(text).toContain(
      'Si una distribuidora no cumple un precio o una promoción, el reclamo se le hace a ella; Hornilla no responde por esa oferta. Esto no te quita los derechos que la ley te da como consumidor.',
    );
    expect(text).toContain('Versión 0.1, preliminar y en revisión.');
    expect(text).toContain('No acepto: eliminar mi cuenta');
    expect(text).not.toContain('¿Eliminar tu cuenta?');
  });

  it('says that only the privacy policy changed when the terms are already accepted', () => {
    const profile = { ...PROFILE, privacy: null };
    const pending = accountOf({
      profile: { status: 'ready', data: { profile, needsTermsAcceptance: true }, reload },
    });

    expect(textOf(inGate(<AcceptTermsPage />, ROUTES.acceptTerms, pending))).toContain(
      'Actualizamos la política de privacidad.',
    );
  });

  it('tells an existing account that the terms changed', () => {
    const outdated = accountOf({
      profile: { status: 'ready', data: { profile: PROFILE, needsTermsAcceptance: true }, reload },
    });

    expect(textOf(inGate(<AcceptTermsPage />, ROUTES.acceptTerms, outdated))).toContain(
      'Actualizamos los términos.',
    );
  });

  it('links the full texts from the terms step, in another tab', () => {
    const html = inGate(<AcceptTermsPage />, ROUTES.acceptTerms);
    const legal = tags(html, 'a').filter((tag) => /href="\/(terminos|privacidad)"/.test(tag));

    expect(legal).toHaveLength(2);
    expect(legal.every((tag) => tag.includes('target="_blank"'))).toBe(true);
  });

  it('shows where the verification e-mail went and the two ways on', () => {
    const text = textOf(inGate(<VerifyEmailPage />, ROUTES.verifyEmail));

    expect(text).toContain(SESSION.email);
    expect(text).toContain('Ya lo verifiqué');
    expect(text).toContain('Reenviar correo');
    expect(text).toContain('Cerrar sesión');
  });

  it('makes only a person who has just registered wait before asking for another e-mail', () => {
    const justRegistered = renderStatic(<VerifyEmailPage />, {
      path: ROUTES.verifyEmail,
      state: JUST_REGISTERED,
      shell: <GateShell />,
      account: accountOf(),
    });
    const later = inGate(<VerifyEmailPage />, ROUTES.verifyEmail);

    expect(textOf(justRegistered)).toContain('Reenviar en 1:00');
    expect(textOf(later)).not.toMatch(/Reenviar en \d/);
  });
});

describe('my account (PLAN 2.1)', () => {
  it('shows name and phone to edit, and the e-mail as read-only', () => {
    const html = inArea('customer', <AccountPage />, accountOf(), ROUTES.account);
    const inputs = tags(html, 'input');
    const named = (name: string) => inputs.find((tag) => tag.includes(`name="${name}"`)) ?? '';

    expect(named('displayName')).toContain('value="Persona Demo"');
    expect(named('phone')).toContain('value=""');
    expect(named('email')).toMatch(/readOnly/i);
    expect(named('email')).toContain(`value="${SESSION.email}"`);
    expect(textOf(html)).toContain('Guardar cambios');
    expect(textOf(html)).toContain('Cerrar sesión');
  });

  // PLAN 2.9
  it('says what signing out erases and where to ask for a deletion or an e-mail change', () => {
    const html = inArea('customer', <AccountPage />, accountOf(), ROUTES.account);
    const text = textOf(html);

    expect(text).toContain(
      'Al cerrar sesión se borran de este dispositivo tu sesión y la copia de tus datos.',
    );
    expect(text).toContain(
      'Para eliminar tu cuenta o cambiar tu correo, escribe a Contacto y reclamos',
    );
    expect(tags(html, 'a').filter((tag) => tag.includes('href="/contacto"'))).toHaveLength(2);
  });

  // PLAN 2.2
  it('leads to the sign-up of a distributor', () => {
    const html = inArea('customer', <AccountPage />, accountOf(), ROUTES.account);

    expect(textOf(html)).toContain('¿Tienes una distribuidora de gas?');
    expect(tags(html, 'a').some((tag) => tag.includes('href="/distribuidora/nueva"'))).toBe(true);
  });

  it('offers the work areas only to an account that has one', () => {
    const customer = textOf(inArea('customer', <AccountPage />, accountOf(), ROUTES.account));
    const owner = inArea('customer', <AccountPage />, OWNER, ROUTES.account);

    expect(customer).not.toContain('Tus espacios de trabajo');
    expect(textOf(owner)).toContain('Tus espacios de trabajo');
    expect(tags(owner, 'a').some((tag) => tag.includes('href="/central"'))).toBe(true);
  });
});

describe('home of each area: an empty state that says what is going on', () => {
  it.each([
    ['customer', <CustomerHomePage key="c" />, accountOf(), 'Dinos dónde y vemos quién llega.'],
    ['driver', <DriverHomePage key="d" />, DRIVER, 'Sin jornada abierta.'],
    ['office', <OfficeHomePage key="o" />, OWNER, 'Todavía no entra ningún pedido.'],
    ['platform', <PlatformHomePage key="p" />, accountOf(), 'Todavía no hay nada que revisar.'],
  ] as const)('%s', (area, page, account, sentence) => {
    const html = inArea(area, page, account);

    expect(count(html, /<h1\b/)).toBe(1);
    expect(textOf(html)).toContain(sentence);
    expect(tags(html, 'a').some((tag) => tag.includes(`href="${ROUTES.account}"`))).toBe(true);
  });

  it('greets the customer by first name and draws the cylinder in one colour', () => {
    const html = inArea('customer', <CustomerHomePage />);

    expect(textOf(html)).toContain('Hola, Persona.');
    expect(html).toContain('aria-label="Balón de 10 kg"');
  });

  // PLAN 2.6: the customer home is the finder, inside the app frame.
  it('gives the signed-in customer the same finder as the public home', () => {
    const html = inArea('customer', <CustomerHomePage />);

    expect(textOf(html)).toContain('Entregar en');
    expect(textOf(html)).toContain('Usar mi ubicación');
    expect(tags(html, 'a').some((tag) => tag.includes('href="/distribuidora/nueva"'))).toBe(true);
  });

  // PLAN 2.2: what the owner sees after founding.
  it('lists what is left to set up, with the catalogue and the staff marked as coming soon', () => {
    const html = inArea('office', <OfficeHomePage />, OWNER);
    const text = textOf(html);

    expect(text).toContain('Completa tu distribuidora');
    expect(text).toContain('Carga tu catálogo');
    expect(text).toContain('Suma a tu personal');
    expect(count(html, /Llega pronto/)).toBe(2);
    expect(tags(html, 'a').some((tag) => tag.includes('href="/d/gas-demo-norte"'))).toBe(true);
  });

  it('keeps the set-up list for the owner: the dispatcher does not see it', () => {
    const dispatcher = accountOf({ current: workingAs([memberOf('dispatcher')]) });

    expect(textOf(inArea('office', <OfficeHomePage />, dispatcher))).not.toContain(
      'Completa tu distribuidora',
    );
  });

  it('welcomes the owner only right after founding', () => {
    const justFounded = renderStatic(<OfficeHomePage />, {
      path: AREA_HOME.office,
      state: JUST_FOUNDED_STATE,
      shell: <AppShell area="office" />,
      account: OWNER,
    });

    expect(textOf(justFounded)).toContain('Gas Demo Norte ya está en Hornilla.');
    expect(textOf(inArea('office', <OfficeHomePage />, OWNER))).not.toContain(
      'ya está en Hornilla',
    );
  });

  it('tells the office how many days of trial are left', () => {
    expect(textOf(inArea('office', <OfficeHomePage />, OWNER))).toMatch(
      /Prueba gratis · quedan? \d+ días?|Prueba terminada/,
    );
  });

  it('warns the office when the distributor is read-only', () => {
    const current = workingAs([memberOf('owner')], { status: 'suspended' });
    const suspended = accountOf({
      current: current.status === 'ready' ? { ...current, isWritable: false } : current,
    });
    const text = textOf(inArea('office', <OfficeHomePage />, suspended));

    expect(text).toContain('Suspendida');
    expect(text).toContain('solo lectura');
  });

  it('has an empty order list for the customer', () => {
    const html = inArea('customer', <CustomerOrdersPage />, accountOf(), ROUTES.customerOrders);

    expect(textOf(html)).toContain('Todavía no tienes pedidos.');
  });
});
