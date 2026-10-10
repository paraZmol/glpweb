import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CheckboxField } from '../../components/common/checkbox-field';
import { count, renderStatic, tags, textOf } from '../../../tests/support/render-static';
import { PublicShell } from '../../components/layout/public-shell';
import { TERMS_VERSION } from '../../domain/legal/versions';
import { ComingSoonPage } from './coming-soon';
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
  const html = inPublicShell(<ComingSoonPage />, '/');

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

  it('never calls the product by its internal name', () => {
    expect(textOf(html)).not.toMatch(/glpweb/i);
    expect(html).toContain('aria-label="Hornilla"');
  });
});

describe('provisional home', () => {
  const html = inPublicShell(<ComingSoonPage />, '/');

  // tests/e2e/smoke.spec.ts looks for exactly these two things.
  it('keeps the headline and the sample price the smoke test reads', () => {
    const [h1 = ''] = html.match(/<h1\b.*?<\/h1>/s) ?? [];

    expect(count(html, /<h1\b/)).toBe(1);
    expect(textOf(h1)).toContain('Pide tu gas');
    expect(textOf(html)).toContain('S/ 38.00');
  });

  it('leads to sign-in and to registration', () => {
    expect(linksTo(html, '/ingresar').length).toBeGreaterThan(0);
    expect(linksTo(html, '/registro').length).toBeGreaterThan(0);
  });
});

describe('registration (PLAN 2.1, 2.7)', () => {
  const html = inPublicShell(<RegisterPage />, '/registro');
  const inputs = tags(html, 'input');
  const named = (name: string) => inputs.find((tag) => tag.includes(`name="${name}"`)) ?? '';

  it('asks for name, e-mail, password and an optional phone, each with its label', () => {
    expect(inputs.map((tag) => /name="([^"]+)"/.exec(tag)?.[1])).toEqual([
      'displayName',
      'email',
      'password',
      'phone',
      'acceptTerms',
    ]);
    expect(count(html, /<label\b/)).toBe(inputs.length);
    expect(textOf(html)).toContain('Celular (opcional)');
  });

  it('shows the terms box unticked', () => {
    expect(named('acceptTerms')).toContain('type="checkbox"');
    expect(named('acceptTerms')).not.toContain(' checked=""');
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
    expect(textOf(form)).toContain('declaro que soy mayor de 18 años');
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
    ['/terminos', <TermsPage key="t" />, 'Términos y condiciones de Hornilla'],
    ['/privacidad', <PrivacyPage key="p" />, 'Política de privacidad de Hornilla'],
    ['/cookies', <CookiesPage key="c" />, 'Cookies y almacenamiento en tu dispositivo'],
  ] as const;

  it.each(PAGES)('%s shows its document under the draft banner', (path, page, title) => {
    const html = inPublicShell(page, path);
    const text = textOf(html);

    expect(count(html, /<h1\b/)).toBe(1);
    expect(text).toContain(title);
    expect(text).toContain('Borrador en revisión.');
    expect(text).toContain(`Versión ${TERMS_VERSION} · 10 de octubre de 2026`);
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

describe('unknown address', () => {
  it('says the page does not exist and offers the way back', () => {
    const html = inPublicShell(<NotFoundPage />, '*', '/no-existe');

    expect(textOf(html)).toContain('Esta página no existe.');
    expect(linksTo(html, '/').length).toBeGreaterThan(0);
  });
});
