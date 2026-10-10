import { describe, expect, it, vi } from 'vitest';
import { accountOf, memberOf, SESSION, workingAs } from '../../../tests/support/account-fixtures';
import { count, renderStatic, tags, textOf } from '../../../tests/support/render-static';
import { APP_AREAS, type AppArea } from '../../domain/auth/access';
import { BRAND_THEMES, deriveBrand } from '../../domain/brand/derive-brand';
import { AREA_HOME } from '../../lib/routes';
import { AppShell } from './app-shell';
import { RequireAccess } from './require-access';

const viewport = vi.hoisted(() => ({ isDesktop: false }));
vi.mock('@/lib/use-media-query', () => ({
  DESKTOP_QUERY: '',
  useMediaQuery: () => viewport.isDesktop,
  useIsDesktop: () => viewport.isDesktop,
}));

const OWNER = accountOf({ current: workingAs([memberOf('owner')]) });
const DRIVER = accountOf({ current: workingAs([memberOf('driver')]) });
const ADMIN = accountOf({ platformAdmin: { status: 'ready', data: true, reload: () => {} } });
const ACCOUNT_FOR: Record<AppArea, typeof OWNER> = {
  customer: accountOf(),
  driver: DRIVER,
  office: OWNER,
  platform: ADMIN,
};

function shell(area: AppArea, account = ACCOUNT_FOR[area], isDesktop = false): string {
  viewport.isDesktop = isDesktop;
  return renderStatic(<p>pantalla de prueba</p>, {
    path: AREA_HOME[area],
    shell: <AppShell area={area} />,
    account,
  });
}

// PLAN 2.4: frame with `data-ambient` per area and adaptive navigation.
describe('AppShell', () => {
  it.each([
    ['customer', 'customer'],
    ['driver', 'driver'],
    ['office', 'office'],
    ['platform', 'office'],
  ] as const)('declares the ambient of the %s area as %s', (area, ambient) => {
    expect(shell(area)).toContain(`data-ambient="${ambient}"`);
  });

  it.each(APP_AREAS)('shows the screen of the %s area inside one main landmark', (area) => {
    const html = shell(area);

    expect(count(html, /<main\b[^>]*id="contenido"/)).toBe(1);
    expect(textOf(html)).toContain('pantalla de prueba');
  });

  it.each(APP_AREAS)('uses a bottom bar on the phone and a side bar on desktop (%s)', (area) => {
    const phone = shell(area, undefined, false);
    const desktop = shell(area, undefined, true);

    expect(phone).toContain('data-bottom-nav');
    expect(count(phone, /<aside\b/)).toBe(0);
    expect(desktop).not.toContain('data-bottom-nav');
    expect(count(desktop, /<aside\b/)).toBe(1);
    expect(count(phone, /<nav\b/)).toBe(1);
    expect(count(desktop, /<nav\b/)).toBe(1);
  });

  it('marks the current destination for assistive technology', () => {
    const html = shell('customer');
    const current = tags(html, 'a').filter((tag) => tag.includes('aria-current="page"'));

    expect(current).toHaveLength(1);
    expect(current[0]).toContain('href="/inicio"');
  });

  it('paints the office and the driver with the colour of their distributor', () => {
    for (const area of ['office', 'driver'] as const) {
      const html = shell(area);
      const derived = deriveBrand('#e11d48');

      expect(html).toContain('data-brand');
      for (const theme of BRAND_THEMES) {
        for (const [tone, value] of Object.entries(derived[theme])) {
          expect(html).toContain(`--brand-${tone}-${theme}:${value}`);
        }
      }
    }
  });

  it('keeps the Hornilla colour in the customer and platform areas', () => {
    const owner = accountOf({ current: workingAs([memberOf('owner')]) });

    expect(shell('customer', owner)).not.toContain('data-brand');
    expect(shell('platform', ADMIN)).not.toContain('data-brand');
  });

  it('names the distributor and the role where the area is hers', () => {
    const text = textOf(shell('office'));

    expect(text).toContain('Gas Demo Norte');
    expect(text).toContain('Titular');
  });

  it('shows the distributor selector only to an account with several', () => {
    const several = accountOf({
      current: workingAs([memberOf('owner', 'd-norte'), memberOf('driver', 'd-sur')]),
    });

    expect(count(shell('office'), /<select\b/)).toBe(0);
    expect(count(shell('office', several), /<select\b/)).toBe(1);
    expect(count(shell('office', several, true), /<select\b/)).toBe(1);
    expect(count(shell('office', several), /<option\b/)).toBe(2);
    expect(shell('office', several)).toContain('Cambiar de distribuidora');
  });

  it('leaves a deactivated membership out of the selector', () => {
    const inactive = { ...memberOf('driver', 'd-sur'), active: false };
    const account = accountOf({ current: workingAs([memberOf('owner', 'd-norte'), inactive]) });

    expect(count(shell('office', account), /<select\b/)).toBe(0);
  });
});

// PLAN 2.4: guards redirect with a message, never a blank page.
describe('RequireAccess', () => {
  const guard = (gate: Parameters<typeof RequireAccess>[0]['gate'], account = accountOf()) =>
    renderStatic(<p>pantalla protegida</p>, {
      path: '/protegida',
      shell: <RequireAccess gate={gate} />,
      account,
    });

  it('shows the screen to an account that may open it', () => {
    expect(textOf(guard('customer'))).toContain('pantalla protegida');
    expect(textOf(guard('office', OWNER))).toContain('pantalla protegida');
  });

  it('shows the frame of a screen, not a blank page, while the account loads', () => {
    const html = guard('customer', accountOf({ session: { status: 'loading' } }));

    expect(html).toContain('role="status"');
    expect(textOf(html)).toContain('Cargando tu cuenta');
    expect(textOf(html)).not.toContain('pantalla protegida');
  });

  it.each([
    ['a signed-out visitor', accountOf({ session: { status: 'signedOut' } }), 'customer'],
    [
      'an unverified account',
      accountOf({
        session: { status: 'signedIn', session: { ...SESSION, emailVerified: false } },
      }),
      'customer',
    ],
    ['a customer who asks for the office', accountOf(), 'office'],
    ['a driver who asks for the office', DRIVER, 'office'],
    ['an owner who asks for the platform', OWNER, 'platform'],
  ] as const)('never shows the screen to %s', (_who, account, gate) => {
    expect(textOf(guard(gate, account))).not.toContain('pantalla protegida');
  });

  it('explains a failed load and offers to retry or to sign out', () => {
    const failed = accountOf({
      profile: { status: 'error', error: new Error('offline'), reload: () => {} },
    });
    const html = guard('customer', failed);

    expect(html).toContain('role="alert"');
    expect(textOf(html)).toContain('No pudimos cargar tu cuenta.');
    expect(textOf(html)).toContain('Reintentar');
    expect(textOf(html)).toContain('Cerrar sesión');
  });
});
