import { describe, expect, it, vi } from 'vitest';
import { publicDistributorOf } from '../../../tests/support/account-fixtures';
import { count, renderStatic, tags, textOf } from '../../../tests/support/render-static';
import { DistributorView } from '../../components/distributor/distributor-view';
import { PublicShell } from '../../components/layout/public-shell';
import { deriveBrand } from '../../domain/brand/derive-brand';
import { DistributorNotFound } from './distributor';

const viewport = vi.hoisted(() => ({ isDesktop: false }));
vi.mock('@/lib/use-media-query', () => ({
  DESKTOP_QUERY: '',
  useMediaQuery: () => viewport.isDesktop,
  useIsDesktop: () => viewport.isDesktop,
}));

// 2026-10-10 is a Saturday; noon and 9 p. m. in Lima (UTC-5).
const SATURDAY_NOON = new Date('2026-10-10T17:00:00Z');
const SATURDAY_NIGHT = new Date('2026-10-11T02:00:00Z');
const PATH = '/d/gas-demo-norte';

function page(patch = {}, now = SATURDAY_NOON, isDesktop = false): string {
  viewport.isDesktop = isDesktop;
  return renderStatic(<DistributorView distributor={publicDistributorOf(patch)} now={now} />, {
    path: PATH,
    shell: <PublicShell />,
  });
}

const hrefs = (html: string) => tags(html, 'a').map((tag) => /href="([^"]+)"/.exec(tag)?.[1]);

// PLAN 2.5: public page of a distributor.
describe('public page of a distributor (PLAN 2.5)', () => {
  it.each([
    ['phone', false],
    ['desktop', true],
  ])('names the distributor in its only h1 and says who sells (%s)', (_size, isDesktop) => {
    const html = page({}, SATURDAY_NOON, isDesktop);
    const [h1 = ''] = html.match(/<h1\b.*?<\/h1>/s) ?? [];

    expect(count(html, /<h1\b/)).toBe(1);
    expect(textOf(h1)).toBe('Gas Demo Norte');
    expect(textOf(html)).toContain('Gas Demo Norte vende y reparte el gas');
    expect(textOf(html)).toContain('Página en Hornilla');
    expect(textOf(html)).not.toContain('Pedidos y seguimiento');
  });

  it('wears the colour of the distributor through BrandTheme', () => {
    const html = page({ brandColor: '#1f2937' });

    expect(html).toContain('data-brand=""');
    expect(html).toContain(`--brand-fill-light:${deriveBrand('#1f2937').light.fill}`);
  });

  it('shows coverage, schedule and whether it attends right now', () => {
    const open = textOf(page());
    const closed = textOf(page({}, SATURDAY_NIGHT));

    expect(open).toContain('5 km');
    expect(open).toContain('Lunes a sábado');
    expect(open).toContain('7:00 a. m.–8:00 p. m.');
    expect(open).toContain('Abierto · cierra a las 8:00 p. m.');
    expect(closed).toContain('Cerrado · abre el lunes a las 7:00 a. m.');
  });

  it('links phone and WhatsApp built from the validated numbers, with the message encoded', () => {
    const links = hrefs(page({ contactPhone: '900000011', whatsapp: '900000012' }));

    expect(links).toContain('tel:+51900000011');
    expect(links.some((href) => href?.startsWith('https://wa.me/51900000012?text=Hola.%20'))).toBe(
      true,
    );
  });

  it('builds no link from a number that is not a Peruvian mobile', () => {
    const links = hrefs(page({ contactPhone: '12345', whatsapp: 'javascript:alert(1)' }));

    expect(links.some((href) => href?.startsWith('tel:') || href?.includes('wa.me'))).toBe(false);
  });

  it('shows the catalogue as a designed empty state: products arrive with phase 3', () => {
    const html = page();

    expect(textOf(html)).toContain('Esta distribuidora todavía no publicó su catálogo.');
    expect(html).toContain('aria-label="Balón de 10 kg"');
    expect(html).not.toContain('role="radiogroup"');
  });

  // PLAN 2.11: a profile that does not take orders reaches this page only for its own staff
  // (the rules hand it to nobody else). They see it as visitors will, and are told so.
  it('tells the staff of an unlisted distributor that only they see the page, without why', () => {
    const html = page({ acceptingOrders: false });
    const text = textOf(html);

    expect(text).toContain(
      'Solo el personal de tu distribuidora ve esta página: ahora no es pública.',
    );
    expect(hrefs(html)).toContain('/central');
    expect(text).not.toMatch(/Abierto|suspendid|prueba|pago|verificad/i);
    // The rest is the page visitors will get: the contact actions are there.
    expect(hrefs(html)).toContain('tel:+51900000011');
  });

  it('shows no such strip on a page that is public', () => {
    expect(textOf(page())).not.toContain('ve esta página: ahora no es pública');
  });

  // PLAN 2.11: anybody can report a page to the platform.
  it('links the way to report the distributor', () => {
    const html = page();

    expect(textOf(html)).toContain('Reportar esta distribuidora');
    expect(tags(html, 'a').filter((tag) => tag.includes('href="/contacto"'))).toHaveLength(2);
  });

  // PLAN 2.9: nothing about the plan, the trial or the founder reaches this page.
  it('shows nothing about the plan of the distributor', () => {
    expect(textOf(page())).not.toMatch(/prueba gratis|suspendid|pago pendiente|plan activo/i);
  });

  it('says that the map is on its way instead of drawing a fake one', () => {
    expect(textOf(page())).toContain('Mapa en camino');
  });
});

describe('link of no distributor (PLAN 2.5)', () => {
  it('has its own 404 with the way back to the finder', () => {
    const html = renderStatic(<DistributorNotFound />, { path: '/d/no-existe' });

    expect(textOf(html)).toContain('Esta distribuidora no existe.');
    expect(hrefs(html)).toContain('/');
  });
});
