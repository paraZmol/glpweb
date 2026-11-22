import { describe, expect, it } from 'vitest';
import { accountOf } from '../../../tests/support/account-fixtures';
import { count, renderStatic, tags, textOf } from '../../../tests/support/render-static';
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
import { JoinShell } from './join-switch';

// Invented data: the repository is public.
const CREATED = new Date('2026-10-15T15:00:00Z');
const INVITE: Invite = {
  id: 'AbCdEfGhIjKlMnOpQrSt',
  distributorId: 'd-norte',
  role: 'driver',
  email: null,
  distributorName: 'Gas Demo Norte',
  invitedByName: null,
  brandColor: null,
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
    renderStatic(
      <JoinRefused refusal={refusal} distributorName="Gas Demo Norte" email={email} linkHash="" />,
    ),
  );

// PLAN 3.2: /unirme.
describe('the screen an invitation link opens', () => {
  it('says where and as what the account is invited, until when, and offers to join', () => {
    const text = textOf(
      renderStatic(
        <JoinCard
          linkHash=""
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

  // PLAN §11 (2026-10-15): the copies the invitation carries.
  it('says who invites and wears the colour of the distributor', () => {
    const html = renderStatic(
      <JoinCard
        linkHash=""
        invite={{ ...INVITE, invitedByName: 'A. Dueña', brandColor: '#0a7cff' }}
        you={{ name: 'Persona Demo', email: null }}
        isRunning={false}
        isOnline
        onJoin={() => {}}
      />,
    );

    expect(textOf(html)).toMatch(/Te invita\s*A\. Dueña/);
    expect(count(html, /data-brand=""/)).toBe(1);
  });

  it('leaves both out for an invitation older than the copies', () => {
    const html = renderStatic(
      <JoinCard
        linkHash=""
        invite={INVITE}
        you={{ name: 'Persona Demo', email: null }}
        isRunning={false}
        isOnline
        onJoin={() => {}}
      />,
    );

    expect(textOf(html)).not.toContain('Te invita');
    expect(count(html, /data-brand=""/)).toBe(0);
  });

  it('does not offer to join without a connection, and says why', () => {
    const text = textOf(
      renderStatic(
        <JoinCard
          linkHash=""
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

  // PLAN §11 (2026-10-16): tied to another address or missing, it cannot tell which.
  it.each([new InviteForAnotherAccountError(), new InviteNotFoundError()])(
    'tells an invitation it cannot read which account is in, and how to change it (%s)',
    (refusal) => {
      const text = refused(refusal);

      expect(text).toContain('Esta invitación no es para esta cuenta.');
      expect(text).toContain(
        'Estás con persona@example.com. Si te invitaron con otro correo, ingresa con esa cuenta. Si no, pide que te envíen la invitación otra vez.',
      );
      expect(text).toContain('Ingresar con otra cuenta de Google');
      expect(text).toContain('Ir a mi inicio');
      expect(text).not.toContain('Unirme');
    },
  );

  it('says the same for another account and for a missing invitation', () => {
    expect(refused(new InviteNotFoundError())).toBe(refused(new InviteForAnotherAccountError()));
  });

  it('makes entering with another account the main way out, and home the quiet one', () => {
    const html = renderStatic(
      <JoinRefused
        refusal={new InviteNotFoundError()}
        distributorName={null}
        email="persona@example.com"
        linkHash=""
      />,
    );
    const switchButton = tags(html, 'button').find((tag) => tag.includes('bg-foreground'));
    const home = tags(html, 'a').find((tag) => tag.includes('href="/app"'));

    expect(switchButton).toBeDefined();
    expect(home).toContain('underline');
    expect(home).not.toContain('bg-foreground');
  });

  // PLAN §11 (2026-10-16): the address of somebody else, said why it is there.
  it('says why an invitation tied to the address carries it, with the privacy policy', () => {
    const tied = { ...INVITE, email: 'persona@example.com', invitedByName: 'A. Dueña' };
    const card = (invite: typeof INVITE) =>
      renderStatic(
        <JoinCard
          linkHash=""
          invite={invite}
          you={{ name: 'P', email: 'persona@example.com' }}
          isRunning={false}
          isOnline
          onJoin={() => {}}
        />,
      );
    const why = 'lleva tu correo porque A. Dueña lo escribió para que solo tu cuenta pueda usarla.';

    expect(textOf(card(tied))).toContain(why);
    expect(tags(card(tied), 'a').some((tag) => tag.includes('href="/privacidad"'))).toBe(true);
    expect(textOf(card({ ...INVITE, email: null }))).not.toContain('lleva tu correo');
  });

  it('offers another account under "Entras como"', () => {
    const text = textOf(
      renderStatic(
        <JoinCard
          invite={INVITE}
          linkHash=""
          you={{ name: 'P', email: 'persona@example.com' }}
          isRunning={false}
          isOnline
          onJoin={() => {}}
        />,
      ),
    );

    expect(text).toMatch(/persona@example\.com\s*¿No es tu cuenta\? Cambiar de cuenta/);
  });

  it('puts the heading of the screen in focus reach, without an outline of its own', () => {
    const html = renderStatic(
      <JoinCard
        invite={INVITE}
        linkHash=""
        you={{ name: 'P', email: null }}
        isRunning={false}
        isOnline
        onJoin={() => {}}
      />,
    );

    expect(tags(html, 'h1')[0]).toContain('tabindex="-1"');
  });

  it('says that a link without its fragment is not complete', () => {
    const html = renderStatic(<JoinPage />, {
      path: ROUTES.join,
      shell: <JoinShell />,
      account: accountOf(),
    });

    expect(textOf(html)).toContain(BROKEN_LINK.title);
    expect(textOf(html)).not.toContain('Qué pasa al unirte.');
  });

  // Its frame says what its way out does: sign out and come back with another account.
  it('offers "Cambiar de cuenta" in its frame instead of "Salir"', () => {
    const html = renderStatic(<JoinPage />, {
      path: ROUTES.join,
      shell: <JoinShell />,
      account: accountOf(),
    });

    expect(textOf(html)).toContain('Cambiar de cuenta');
    expect(textOf(html)).not.toContain('Salir');
  });
});
