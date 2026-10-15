import { describe, expect, it } from 'vitest';
import { accountOf } from '../../../tests/support/account-fixtures';
import { renderStatic, textOf } from '../../../tests/support/render-static';
import { FocusShell } from '../../components/layout/focus-shell';
import {
  AlreadyMemberError,
  InviteExpiredError,
  InviteForAnotherAccountError,
  InviteNotFoundError,
  InviteRevokedError,
  InviteUsedError,
} from '../../domain/staff/errors';
import type { Invite } from '../../domain/staff/invite';
import { ROUTES } from '../../lib/routes';
import { JoinPage } from './join';
import { JoinCard } from './join-card';
import { BROKEN_LINK } from './join-copy';
import { JoinRefused } from './join-stop';

// Invented data: the repository is public.
const CREATED = new Date('2026-10-15T15:00:00Z');
const INVITE: Invite = {
  id: 'AbCdEfGhIjKlMnOpQrSt',
  distributorId: 'd-norte',
  role: 'driver',
  email: null,
  distributorName: 'Gas Demo Norte',
  status: 'pending',
  createdBy: 'u-titular',
  createdAt: CREATED,
  updatedAt: CREATED,
  acceptedBy: null,
  acceptedAt: null,
  revokedBy: null,
  revokedAt: null,
};

const refused = (refusal: Error, email: string | null = 'persona@example.com') =>
  textOf(
    renderStatic(<JoinRefused refusal={refusal} distributorName="Gas Demo Norte" email={email} />),
  );

// PLAN 3.2: /unirme.
describe('the screen an invitation link opens', () => {
  it('says where and as what the account is invited, until when, and offers to join', () => {
    const text = textOf(
      renderStatic(
        <JoinCard
          invite={INVITE}
          you={{ name: 'Persona Demo', email: 'persona@example.com' }}
          isRunning={false}
          isOnline
          onJoin={() => {}}
        />,
      ),
    );

    expect(text).toContain('Gas Demo Norte te invita como repartidor.');
    expect(text).toMatch(/Vence el 22 oct.? 2026/);
    expect(text).toContain('Persona Demo · persona@example.com');
    expect(text).toContain('Unirme a Gas Demo Norte');
  });

  it('does not offer to join without a connection, and says why', () => {
    const text = textOf(
      renderStatic(
        <JoinCard
          invite={INVITE}
          you={{ name: 'P', email: null }}
          isRunning={false}
          isOnline={false}
          onJoin={() => {}}
        />,
      ),
    );

    expect(text).toContain('Sin conexión: para unirte necesitas internet.');
  });

  it.each([
    [new InviteNotFoundError(), 'No encontramos esta invitación.'],
    [new InviteExpiredError(), 'Esta invitación venció.'],
    [new InviteUsedError(), 'Esta invitación ya se usó.'],
    [new InviteRevokedError(), 'Esta invitación fue anulada.'],
    [new AlreadyMemberError(true), 'Ya formas parte de Gas Demo Norte.'],
    [new AlreadyMemberError(false), 'Ya no tienes acceso a Gas Demo Norte.'],
  ])('says plainly when it cannot be used (%s)', (refusal, title) => {
    const text = refused(refusal);

    expect(text).toContain(title);
    // The headline is not said twice.
    expect(text.split(title.slice(0, -1)).length).toBe(2);
    expect(text).toContain('Ir a mi inicio');
    expect(text).not.toContain('Unirme');
  });

  it('tells an invitation for another account which account is in, and how to change it', () => {
    const text = refused(new InviteForAnotherAccountError());

    expect(text).toContain('Esta invitación es para otra cuenta de Google.');
    expect(text).toContain('Ahora estás con persona@example.com. Cierra sesión');
    expect(text).toContain('Cerrar sesión');
  });

  it('says that a link without its fragment is not complete', () => {
    const html = renderStatic(<JoinPage />, {
      path: ROUTES.join,
      shell: <FocusShell />,
      account: accountOf(),
    });

    expect(textOf(html)).toContain(BROKEN_LINK.title);
    expect(textOf(html)).not.toContain('Qué pasa al unirte.');
  });
});
