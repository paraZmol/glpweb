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

// PLAN 2.1, §11 (2026-10-14): one way in. Signing in and creating an account are the same
// Google button, so the header offers "Ingresar" and, on the two entry screens, nothing.
describe('account links of the public header', () => {
  it('offers only "Ingresar" on any other screen', () => {
    expect(linksAt('/')).toEqual(['/ingresar']);
  });

  it.each(['/ingresar', '/registro'])('offers no link on the entry screen %s', (path) => {
    expect(linksAt(path)).toEqual([]);
  });

  it('leads a signed-in account to its own area', () => {
    auth.state = {
      status: 'signedIn',
      session: {
        uid: 'u-demo',
        email: 'persona@example.com',
        emailVerified: true,
        displayName: 'Persona Demo',
        providerIds: ['google.com'],
      },
    };

    expect(linksAt('/')).toEqual(['/app']);
  });
});
