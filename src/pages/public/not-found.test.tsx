import { describe, expect, it, vi } from 'vitest';
import { renderStatic, tags, textOf } from '../../../tests/support/render-static';
import type { SessionState } from '../../domain/auth/session';
import { NotFoundPage } from './not-found';

const auth = vi.hoisted(() => ({ state: { status: 'loading' } as SessionState }));
vi.mock('@/features/auth/use-session', () => ({ useSession: () => auth.state }));

const SIGNED_IN: SessionState = {
  status: 'signedIn',
  session: {
    uid: 'u-demo',
    email: 'persona@example.com',
    emailVerified: true,
    displayName: 'Persona Demo',
    providerIds: ['password'],
  },
};

function waysOn(state: SessionState) {
  auth.state = state;
  const html = renderStatic(<NotFoundPage />, { path: '*', at: '/no-existe' });
  const links = tags(html, 'a')
    .filter((tag) => !tag.includes('href="#contenido"') && !tag.includes('href="/cookies"'))
    .map((tag) => /href="([^"]+)"/.exec(tag)?.[1]);
  return { links, text: textOf(html) };
}

// PLAN 2.4. role-walker 2026-10-11: the page offered "Ingresar" to somebody already signed in.
describe('ways on from an address that does not exist', () => {
  it('offers the home and the sign-in to a visitor', () => {
    const { links, text } = waysOn({ status: 'signedOut' });

    expect(links).toEqual(['/', '/ingresar']);
    expect(text).toContain('Ingresar');
  });

  it('takes a signed-in account to its own area and never asks it to sign in', () => {
    const { links, text } = waysOn(SIGNED_IN);

    expect(links).toEqual(['/app', '/']);
    expect(text).toContain('Ir a mi inicio');
    expect(text).not.toContain('Ingresar');
  });

  it('shows only the way that suits everybody while the session is not known yet', () => {
    expect(waysOn({ status: 'loading' }).links).toEqual(['/']);
  });
});
