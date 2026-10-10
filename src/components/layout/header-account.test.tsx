import { describe, expect, it, vi } from 'vitest';
import { renderStatic, tags } from '../../../tests/support/render-static';
import type { SessionState } from '../../domain/auth/session';
import HeaderAccount from './header-account';

const auth = vi.hoisted(() => ({ state: { status: 'signedOut' } as SessionState }));
vi.mock('@/features/auth/use-session', () => ({ useSession: () => auth.state }));

const linksAt = (path: string) =>
  tags(renderStatic(<HeaderAccount />, { path }), 'a')
    .filter((tag) => !tag.includes('href="#contenido"'))
    .map((tag) => /href="([^"]+)"/.exec(tag)?.[1]);

// PLAN 2.9: the header never offers the screen the visitor is already on.
describe('account links of the public header', () => {
  it('offers both ways in on any other screen', () => {
    expect(linksAt('/')).toEqual(['/registro', '/ingresar']);
  });

  it('offers only "Crear cuenta" on the sign-in screen', () => {
    expect(linksAt('/ingresar')).toEqual(['/registro']);
  });

  it('offers only "Ingresar" on the registration screen', () => {
    expect(linksAt('/registro')).toEqual(['/ingresar']);
  });

  it('leads a signed-in account to its own area', () => {
    auth.state = {
      status: 'signedIn',
      session: {
        uid: 'u-demo',
        email: 'persona@example.com',
        emailVerified: true,
        displayName: 'Persona Demo',
        providerIds: ['password'],
      },
    };

    expect(linksAt('/')).toEqual(['/app']);
  });
});
