import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CheckboxField } from '../../components/common/checkbox-field';
import { count, renderStatic, tags, textOf } from '../../../tests/support/render-static';
import { PublicShell } from '../../components/layout/public-shell';
import { CURRENT_TEXT_VERSIONS } from '../../domain/legal/text-editions';
import { ContactPage } from './contact';
import { HomePage } from './home';
import { CookiesPage, PrivacyPage, TermsPage } from './index';
import { NotFoundPage } from './not-found';
import { RegisterPage } from './register';
import { ResetPasswordPage } from './reset-password';
import { SignInPage } from './sign-in';

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

describe('registration (PLAN 2.1, 2.11)', () => {
  const html = inPublicShell(<RegisterPage />, '/registro');
  const inputs = tags(html, 'input');
  const named = (name: string) => inputs.find((tag) => tag.includes(`name="${name}"`)) ?? '';

  it('asks for name, e-mail, password and an optional phone, each with its label', () => {
    expect(inputs.map((tag) => /name="([^"]+)"/.exec(tag)?.[1])).toEqual([
      'displayName',
      'email',
      'password',
      'phone',
    ]);
    expect(count(html, /<label\b/)).toBe(inputs.length);
    expect(textOf(html)).toContain('Celular (opcional)');
  });

  it('is titled without promising an order', () => {
    const [h1 = ''] = html.match(/<h1\b.*?<\/h1>/s) ?? [];

    expect(textOf(h1)).toBe('Crea tu cuenta en Hornilla.');
  });

  // PLAN 2.11: registering records no consent, so the form has no box to tick.
  it('asks for no consent and says where the terms are accepted', () => {
    const text = textOf(html).replaceAll(' (se abre en otra pestaña)', '');

    expect(inputs.some((tag) => tag.includes('type="checkbox"'))).toBe(false);
    expect(text).toContain(
      'Los Términos y condiciones y la Política de privacidad se aceptan en el paso siguiente, después de verificar tu correo.',
    );
    expect(text).not.toMatch(/Acepto los|autorizo a Hornilla/);
  });

  it('says what Google hands over under its button, with the official mark as a file', () => {
    expect(textOf(html)).toContain(
      'Google nos entrega tu nombre, tu correo y tu foto de perfil. La foto no la mostramos ni la usamos: la quitamos del perfil de tu cuenta al terminar el ingreso, aunque el servicio de ingreso conserva la copia que Google le entrega.',
    );
    expect(tags(html, 'img').some((tag) => tag.includes('src="/google-g.svg"'))).toBe(true);
  });

  it('would show a ticked box as ticked (control for the test above)', () => {
    const ticked = renderToStaticMarkup(
      <CheckboxField checked onChange={() => {}}>
        Acepto
      </CheckboxField>,
    );

    expect(ticked).toContain(' checked=""');
  });

  it('opens the terms and the privacy policy in another tab, so nothing typed is lost', () => {
    const form = html.slice(html.indexOf('<form'), html.indexOf('</form>'));

    for (const href of ['/terminos', '/privacidad']) {
      const [link = ''] = linksTo(form, href);
      expect(link).toContain('target="_blank"');
      expect(link).toContain('rel="noopener"');
    }
  });

  it('tells password managers what each field is, and the minimum length', () => {
    expect(named('password')).toContain('autoComplete="new-password"');
    expect(named('password')).toContain('type="password"');
    expect(named('email')).toContain('autoComplete="email"');
    expect(textOf(html)).toContain('Mínimo 8 caracteres.');
  });

  it('has a single submit button', () => {
    expect(tags(html, 'button').filter((tag) => tag.includes('type="submit"'))).toHaveLength(1);
  });
});

describe('sign-in and password reset (PLAN 2.1)', () => {
  it('offers e-mail, Google and the way to reset the password', () => {
    const html = inPublicShell(<SignInPage />, '/ingresar');

    expect(tags(html, 'input').map((tag) => /name="([^"]+)"/.exec(tag)?.[1])).toEqual([
      'email',
      'password',
    ]);
    expect(textOf(html)).toContain('Continuar con Google');
    expect(linksTo(html, '/restablecer')).toHaveLength(1);
    expect(linksTo(html, '/registro').length).toBeGreaterThan(0);
  });

  it('explains the detour only to a visitor sent by a guard', () => {
    const direct = inPublicShell(<SignInPage />, '/ingresar');

    expect(textOf(direct)).not.toContain('Ingresa para continuar.');
  });

  it('asks only for the e-mail to reset the password', () => {
    const html = inPublicShell(<ResetPasswordPage />, '/restablecer');

    expect(tags(html, 'input')).toHaveLength(1);
    expect(linksTo(html, '/ingresar').length).toBeGreaterThan(0);
  });
});

describe('legal pages (PLAN 2.7)', () => {
  const PAGES = [
    ['/terminos', <TermsPage key="t" />, 'Términos y condiciones de Hornilla', 'terms'],
    ['/privacidad', <PrivacyPage key="p" />, 'Política de privacidad de Hornilla', 'privacy'],
    ['/cookies', <CookiesPage key="c" />, 'Cookies y almacenamiento en tu dispositivo', 'cookies'],
  ] as const;

  it.each(PAGES)('%s shows its document under the draft banner', (path, page, title, id) => {
    const html = inPublicShell(page, path);
    const text = textOf(html);

    expect(count(html, /<h1\b/)).toBe(1);
    expect(text).toContain(title);
    expect(text).toContain('Borrador en revisión.');
    expect(text).toMatch(/es la que rige mientras Hornilla está en prueba/);
    expect(text).toContain('te pediremos aceptarla de nuevo.');
    expect(text).toContain(`Versión ${CURRENT_TEXT_VERSIONS[id]} · 11 de octubre de 2026`);
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
