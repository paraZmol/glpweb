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
import { AREA_HOME, ROUTES } from '../lib/routes';
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
    const [box = ''] = tags(html, 'input');

    expect(textOf(html)).toContain('Un paso antes de empezar.');
    expect(box).toContain('type="checkbox"');
    expect(box).not.toContain(' checked=""');
    expect(textOf(html)).toContain('Aceptar y continuar');
    expect(textOf(html)).toContain('Cerrar sesión');
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
    ['customer', <CustomerHomePage key="c" />, accountOf(), 'Todavía no hay distribuidoras'],
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
