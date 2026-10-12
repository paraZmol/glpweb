import { describe, expect, it } from 'vitest';
import { count, renderStatic, tags, textOf } from '../../../tests/support/render-static';
import { PublicShell } from '../../components/layout/public-shell';
import { CURRENT_TEXT_VERSIONS } from '../../domain/legal/text-editions';
import { ContactPage } from './contact';
import { HomePage } from './home';
import { CookiesPage, PrivacyPage, TermsPage } from './index';
import { NotFoundPage } from './not-found';
import { RegisterPage, SignInPage } from './sign-in';

const inPublicShell = (page: React.ReactElement, path: string, at = path) =>
  renderStatic(page, { path, at, shell: <PublicShell /> });

const linksTo = (html: string, href: string) =>
  tags(html, 'a').filter((tag) => tag.includes(`href="${href}"`));

describe('public frame (PLAN 2.4)', () => {
  const html = inPublicShell(<HomePage />, '/');

  it('offers a skip link and one main landmark', () => {
    expect(html).toContain('href="#contenido"');
    expect(count(html, /<main\b[^>]*id="contenido"/)).toBe(1);
  });

  it('links the three legal pages from the footer', () => {
    const footer = html.slice(html.indexOf('<footer'));

    expect(linksTo(footer, '/terminos')).toHaveLength(1);
    expect(linksTo(footer, '/privacidad')).toHaveLength(1);
    expect(linksTo(footer, '/cookies')).toHaveLength(1);
  });

  // PLAN 2.9
  it('links "Contacto y reclamos" from the footer', () => {
    const footer = html.slice(html.indexOf('<footer'));

    expect(linksTo(footer, '/contacto')).toHaveLength(1);
    expect(textOf(footer)).toContain('Contacto y reclamos');
  });

  it('never calls the product by its internal name', () => {
    expect(textOf(html)).not.toMatch(/glpweb/i);
    expect(html).toContain('aria-label="Hornilla"');
  });
});

// PLAN 2.6: the finder is the home, for everybody. Without a point nothing is searched yet.
describe('home with the finder (PLAN 2.6)', () => {
  const html = inPublicShell(<HomePage />, '/');
  const text = textOf(html);

  // tests/e2e/smoke.spec.ts looks for this headline.
  it('keeps "Pide tu gas" in its only h1', () => {
    const [h1 = ''] = html.match(/<h1\b.*?<\/h1>/s) ?? [];

    expect(count(html, /<h1\b/)).toBe(1);
    expect(textOf(h1)).toContain('Pide tu gas');
  });

  it('asks where to deliver, saying what the location is for before asking for it', () => {
    const reason = text.indexOf('Tu ubicación se usa solo para');

    expect(text).toContain('Entregar en');
    expect(reason).toBeGreaterThan(-1);
    expect(reason).toBeLessThan(text.indexOf('Usar mi ubicación'));
    expect(text).toContain('Escribir las coordenadas');
  });

  it('shows the state without a location instead of an empty list or a spinner', () => {
    expect(text).toContain('Dinos dónde y vemos quién llega.');
    expect(html).not.toContain('aria-busy="true"');
  });

  it('draws the place of the map as a gap, and says so', () => {
    expect(text).toContain('Mapa en camino');
    expect(text).toContain('Aquí va a ir el mapa.');
  });

  it('promises only what works today and marks the rest as under construction', () => {
    expect(text).toContain('En construcción');
    expect(text).toContain('Así va a funcionar.');
    expect(text).not.toMatch(/S\/ \d/);
  });

  it('leads owners to the sign-up of their distributor', () => {
    expect(text).toContain('¿Tienes una distribuidora de gas?');
    expect(linksTo(html, '/distribuidora/nueva').length).toBeGreaterThan(0);
  });
});

// PLAN 2.1: sign-in is with Google only. `/ingresar` and `/registro` are the same screen with
// other words: the first sign-in is what creates the account.
describe.each([
  ['/ingresar', <SignInPage key="i" />, 'Ingresa a Hornilla.', '/registro'],
  ['/registro', <RegisterPage key="r" />, 'Crea tu cuenta en Hornilla.', '/ingresar'],
] as const)('entry screen %s', (path, page, title, otherPath) => {
  const html = inPublicShell(page, path);
  const main = html.slice(html.indexOf('<main'), html.indexOf('</main>'));

  it('is titled for what the visitor came to do', () => {
    const [h1 = ''] = html.match(/<h1\b.*?<\/h1>/s) ?? [];

    expect(textOf(h1)).toBe(title);
  });

  it('offers Google as the only way in: no field, no password, nothing to send', () => {
    expect(tags(main, 'input')).toEqual([]);
    expect(count(main, /<form\b/)).toBe(0);
    expect(tags(main, 'button').map((tag) => tag.includes('type="button"'))).toEqual([true]);
    expect(textOf(main)).toContain('Continuar con Google');
    expect(textOf(main)).not.toMatch(/contraseña que (escribir|recordar)|Olvidaste|verifica/i);
  });

  it('says what Google hands over under its button, with the official mark as a file', () => {
    expect(textOf(main)).toContain(
      'Google nos entrega tu nombre, tu correo y tu foto de perfil. La foto no la mostramos ni la usamos: la quitamos del perfil de tu cuenta al terminar el ingreso, aunque el servicio de ingreso conserva la copia que Google le entrega.',
    );
    expect(tags(main, 'img').some((tag) => tag.includes('src="/google-g.svg"'))).toBe(true);
  });

  // PLAN 2.11: entering records no consent, so the screen has no box to tick.
  it('asks for no consent and says where the terms are accepted', () => {
    const text = textOf(main).replaceAll(' (se abre en otra pestaña)', '');

    expect(text).toContain(
      'Los Términos y condiciones y la Política de privacidad se aceptan en el paso siguiente, la primera vez que ingresas.',
    );
    expect(text).not.toMatch(/Acepto los|autorizo a Hornilla/);
    for (const href of ['/terminos', '/privacidad']) {
      const [link = ''] = linksTo(main, href);
      expect(link).toContain('target="_blank"');
      expect(link).toContain('rel="noopener"');
    }
  });

  it('leads to the other entry screen, and to nothing that no longer exists', () => {
    expect(linksTo(main, otherPath)).toHaveLength(1);
    expect(linksTo(html, '/restablecer')).toEqual([]);
    expect(linksTo(html, '/verificar-correo')).toEqual([]);
  });

  it('explains the detour only to a visitor sent by a guard', () => {
    expect(textOf(html)).not.toContain('Ingresa para continuar.');
  });
});

describe('legal pages (PLAN 2.7)', () => {
  const PAGES = [
    ['/terminos', <TermsPage key="t" />, 'Términos y condiciones de Hornilla', 'terms'],
    ['/privacidad', <PrivacyPage key="p" />, 'Política de privacidad de Hornilla', 'privacy'],
    ['/cookies', <CookiesPage key="c" />, 'Cookies y almacenamiento en tu dispositivo', 'cookies'],
  ] as const;
  // The date in the header of each document (docs/legal), as the page writes it.
  const PUBLISHED = {
    terms: '12 de octubre de 2026',
    privacy: '12 de octubre de 2026',
    cookies: '12 de octubre de 2026',
  } as const;

  it.each(PAGES)('%s shows its document under the draft banner', (path, page, title, id) => {
    const html = inPublicShell(page, path);
    const text = textOf(html);

    expect(count(html, /<h1\b/)).toBe(1);
    expect(text).toContain(title);
    expect(text).toContain('Borrador en revisión.');
    expect(text).toMatch(/es la que rige mientras Hornilla está en prueba/);
    expect(text).toContain('te pediremos aceptarla de nuevo.');
    expect(text).toContain(`Versión ${CURRENT_TEXT_VERSIONS[id]} · ${PUBLISHED[id]}`);
  });

  it.each(PAGES)('%s renders text only: no markup from the document', (path, page) => {
    const html = inPublicShell(page, path);

    expect(html).not.toMatch(/<script|<iframe|dangerouslySetInnerHTML|\son[a-z]+="/i);
    expect(textOf(html)).not.toMatch(/\*\*|\|---/);
  });

  it.each(PAGES)('%s links its sections and the other two documents', (path, page) => {
    const html = inPublicShell(page, path);
    const anchors = tags(html, 'a').filter(
      (tag) => tag.includes('href="#') && !tag.includes('#contenido'),
    );
    const others = PAGES.map(([other]) => other).filter((other) => other !== path);

    expect(anchors.length).toBeGreaterThan(2);
    for (const anchor of anchors) {
      const id = /href="#([^"]+)"/.exec(anchor)?.[1];
      expect(html).toContain(`id="${id}"`);
    }
    for (const other of others) expect(linksTo(html, other).length).toBeGreaterThan(0);
  });

  it('shows the storage table of the cookies page with its column names', () => {
    const html = inPublicShell(<CookiesPage />, '/cookies');

    expect(count(html, /<th\b[^>]*scope="col"/)).toBe(3);
    expect(textOf(html)).toContain('Sesión iniciada');
  });
});

// PLAN 2.9: the two ways to complain, and never an invented address.
describe('contact and complaints (PLAN 2.9)', () => {
  const html = inPublicShell(<ContactPage />, '/contacto');
  const text = textOf(html);

  it('explains both ways: the distributor for an order, Hornilla for the platform', () => {
    expect(count(html, /<h1\b/)).toBe(1);
    expect(text).toContain('Por un pedido, un precio o una promoción');
    expect(text).toContain('Ante la distribuidora.');
    expect(text).toContain('Por el funcionamiento de la plataforma');
    expect(text).toContain('Ante Hornilla.');
  });

  it('shows the address of the terms, or says plainly that it is not published yet', () => {
    const mailLinks = tags(html, 'a').filter((tag) => tag.includes('href="mailto:'));
    const isPending = text.includes('todavía no está publicado');

    expect(mailLinks.length === 1).toBe(!isPending);
    expect(text).not.toMatch(/\[[^\]]*\]/);
  });
});

describe('unknown address', () => {
  it('says the page does not exist and offers the way back', () => {
    const html = inPublicShell(<NotFoundPage />, '*', '/no-existe');

    expect(textOf(html)).toContain('Esta página no existe.');
    expect(linksTo(html, '/').length).toBeGreaterThan(0);
  });
});
