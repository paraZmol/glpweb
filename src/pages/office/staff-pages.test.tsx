import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  accountOf,
  distributorOf,
  memberOf,
  SESSION,
  workingAs,
} from '../../../tests/support/account-fixtures';
import { renderStatic, tags, textOf } from '../../../tests/support/render-static';
import { AppShell } from '../../components/layout/app-shell';
import type { Helper } from '../../domain/staff/helper';
import type { Invite } from '../../domain/staff/invite';
import type { Member } from '../../domain/tenancy/types';
import { ROUTES } from '../../lib/routes';
import { HelperRow } from './helper-row';
import { InviteForm } from './invite-form';
import { InviteReady } from './invite-ready';
import { InviteRow } from './invite-row';
import { ListingStatus, NOTE_ELSEWHERE } from './listing-status';
import { MemberRow, type MemberRowProps } from './member-row';
import { RoleEditor } from './member-row-edits';
import { SetupChecklist } from './setup-checklist';
import { StaffPage } from './staff';
import {
  ANY_ACCOUNT,
  EMAIL_RECOMMENDED,
  FOUNDER_SEAL,
  OWNERS_BY_FOUNDER,
  PLAN_READ_ONLY,
  ROLE_CHANGE_REACH,
} from './staff-copy';

// Invented data: the repository is public.
const CREATED = new Date('2026-10-15T15:00:00Z');
const LINK = 'https://example.com/unirme#d=d-norte&c=AbCdEfGhIjKlMnOpQrSt';
const ACTOR = { uid: SESSION.uid, email: SESSION.email };
const noop = () => Promise.resolve(true);
const hrefs = (html: string) => tags(html, 'a').map((tag) => /href="([^"]+)"/.exec(tag)?.[1]);

const person = (patch: Partial<Member> = {}): Member => ({
  ...memberOf('driver'),
  uid: 'u-otra',
  displayName: 'R. Reparte',
  ...patch,
});

function row(patch: Partial<MemberRowProps> = {}) {
  const props: MemberRowProps = {
    member: person(),
    distributorName: 'Gas Demo Norte',
    isMe: false,
    isFounder: false,
    roles: ['dispatcher', 'driver'],
    isLocked: false,
    busy: null,
    onRole: noop,
    onActive: noop,
    ...patch,
  };
  return textOf(renderStatic(<MemberRow {...props} />));
}

const invite = (patch: Partial<Invite> = {}): Invite => ({
  id: 'AbCdEfGhIjKlMnOpQrSt',
  distributorId: 'd-norte',
  role: 'driver',
  email: null,
  distributorName: 'Gas Demo Norte',
  invitedByName: null,
  brandColor: null,
  status: 'pending',
  createdBy: SESSION.uid,
  createdAt: CREATED,
  updatedAt: CREATED,
  acceptedBy: null,
  acceptedAt: null,
  revokedBy: null,
  revokedAt: null,
  ...patch,
});

function inviteRow(now: Date, canShare = true, patch: Partial<Invite> = {}) {
  return renderStatic(
    <InviteRow
      invite={invite(patch)}
      link={LINK}
      distributorName="Gas Demo Norte"
      now={now}
      canShare={canShare}
      isLocked={false}
      isBusy={false}
      onRevoke={noop}
    />,
  );
}

function staffPage(role: 'owner' | 'dispatcher', status: 'active' | 'suspended' = 'active') {
  const working = workingAs([memberOf(role)], { status });
  const current =
    working.status === 'ready' ? { ...working, isWritable: status === 'active' } : working;
  return textOf(
    renderStatic(<StaffPage />, {
      path: ROUTES.officeStaff,
      shell: <AppShell area="office" />,
      account: accountOf({ current }),
    }),
  );
}

// PLAN 3.2: /central/personal.
describe('staff screen of the office', () => {
  it('gives the owner the one way to invite and never a blank screen while the lists load', () => {
    const text = staffPage('owner');

    expect(text).toContain('Tu personal.');
    expect(text).toContain('Invitar a alguien');
    expect(text).toContain('Cargando tu personal');
    expect(text).toContain('Ayudantes');
  });

  it('shows a read-only distributor under its notice, with nothing to invite', () => {
    const text = staffPage('owner', 'suspended');

    expect(text).toContain('Hornilla suspendió tu distribuidora');
    expect(text).not.toContain('Invitar a alguien');
  });

  it('says why when the plan, not the platform, holds it', () => {
    const working = workingAs([memberOf('owner')], { status: 'pastDue' });
    const current = working.status === 'ready' ? { ...working, isWritable: false } : working;
    const html = renderStatic(<StaffPage />, {
      path: ROUTES.officeStaff,
      shell: <AppShell area="office" />,
      account: accountOf({ current }),
    });

    expect(textOf(html)).toContain(PLAN_READ_ONLY);
  });

  it('does not open for the central', () => {
    expect(staffPage('dispatcher')).not.toContain('Tu personal.');
  });

  it('lists "Personal" in the navigation of an owner only', () => {
    expect(staffPage('owner')).toContain('Personal');
    const dispatcher = renderStatic(<p>monitor</p>, {
      path: ROUTES.officeHome,
      shell: <AppShell area="office" />,
      account: accountOf({ current: workingAs([memberOf('dispatcher')]) }),
    });
    expect(hrefs(dispatcher)).not.toContain(ROUTES.officeStaff);
  });
});

describe('one person of the staff', () => {
  it('lets the owner change the role of another person or switch it off', () => {
    const text = row();

    expect(text).toContain('R. Reparte');
    expect(text).toContain('Reparto');
    expect(text).toContain('Con acceso');
    expect(text).toContain('Cambiar rol');
    expect(text).toContain('Desactivar');
  });

  it('offers only to reactivate someone switched off', () => {
    const text = row({ member: person({ active: false }) });

    expect(text).toContain('Sin acceso');
    expect(text).toContain('Reactivar');
    expect(text).not.toContain('Cambiar rol');
  });

  it('marks the account itself and the founder, without a control the rules would refuse', () => {
    const text = row({ member: person({ role: 'owner' }), isMe: true, isFounder: true, roles: [] });

    expect(text).toContain('(tú)');
    expect(text).toContain(FOUNDER_SEAL);
    expect(text).not.toContain('Cambiar rol');
    expect(text).not.toContain('Desactivar');
  });

  it('tells a co-owner why another owner offers nothing', () => {
    const text = row({ member: person({ role: 'owner' }), roles: [], note: OWNERS_BY_FOUNDER });

    expect(text).toContain(OWNERS_BY_FOUNDER);
    expect(text).not.toContain('Cambiar rol');
  });
});

describe('one invitation that waits', () => {
  it('says until when it works and shares it by WhatsApp with the whole link', () => {
    const html = inviteRow(new Date('2026-10-16T15:00:00Z'));
    const whatsapp = hrefs(html).find((href) => href?.startsWith('https://wa.me/'));

    expect(textOf(html)).toMatch(/Vence el 22 oct.? 2026/);
    expect(textOf(html)).toContain('Sin correo: la puede usar quien tenga el enlace');
    expect(textOf(html)).toContain(
      'Compartir por WhatsApp de Reparto (abre WhatsApp en otra pestaña)',
    );
    expect(textOf(html)).toContain('Copiar enlace');
    expect(textOf(html)).toContain('Anular');
    expect(new URL(whatsapp?.replaceAll('&amp;', '&') ?? '').searchParams.get('text')).toContain(
      LINK,
    );
  });

  // Two that wait for the same role must be told apart (ux-reviewer, 2026-11-21).
  it('says when it was created, before until when it works', () => {
    const today = textOf(inviteRow(new Date('2026-10-15T20:00:00Z')));
    const yesterday = textOf(inviteRow(new Date('2026-10-16T15:00:00Z')));
    const older = textOf(inviteRow(new Date('2026-10-19T15:00:00Z')));

    expect(today).toMatch(/Creada hoy, 10:00 a\. m\.\s*Vence el 22 oct/);
    expect(yesterday).toContain('Creada ayer, 10:00 a. m.');
    expect(older).toMatch(/Creada el 15 oct\.? 2026, 10:00 a\. m\./);
  });

  it('names itself with its role and when it was created', () => {
    const html = inviteRow(new Date('2026-10-15T20:00:00Z'));

    expect(tags(html, 'article')[0]).toMatch(
      /aria-label="Invitación de Reparto, creada hoy, 10:00\sa\.\sm\."/,
    );
  });

  it('says that one past its seven days ran out, and only offers to withdraw it', () => {
    const text = textOf(
      inviteRow(new Date('2026-10-23T15:00:00Z'), true, { email: 'r@example.com' }),
    );

    expect(text).toMatch(/Venció el 22 oct.? 2026/);
    expect(text).toContain('r@example.com');
    expect(text).not.toContain('Compartir por WhatsApp');
    expect(text).toContain('Anular');
  });

  it('is not shared while the distributor is read-only, but can still be withdrawn', () => {
    const text = textOf(inviteRow(new Date('2026-10-16T15:00:00Z'), false));

    expect(text).not.toContain('Copiar enlace');
    expect(text).toContain('Anular');
  });
});

describe('sharing an invitation', () => {
  afterEach(() => vi.unstubAllGlobals());

  const ready = () =>
    renderStatic(
      <InviteReady
        link={LINK}
        role="driver"
        email={null}
        distributorName="Gas Demo Norte"
        onDone={() => {}}
      />,
    );

  it('says WhatsApp opens, and what to do there, when it goes through WhatsApp', () => {
    const text = textOf(ready());

    expect(text).toContain('Compartir por WhatsApp');
    expect(text).toContain('Se abrirá WhatsApp: elige el chat de la persona y envía.');
    expect(text).toContain(`${ANY_ACCOUNT}.`);
  });

  it('calls it "Compartir enlace" where the device has its own share sheet', () => {
    vi.stubGlobal('navigator', { share: () => Promise.resolve(), canShare: () => true });
    const html = ready();

    expect(textOf(html)).toContain('Compartir enlace');
    expect(textOf(html)).not.toContain('WhatsApp');
    expect(hrefs(html).some((href) => href?.startsWith('https://wa.me/'))).toBe(false);
  });
});

describe('changing the role of a person', () => {
  it('says what happens to the session it has open', () => {
    const text = textOf(
      renderStatic(
        <RoleEditor
          member={person()}
          roles={['dispatcher', 'driver']}
          isLocked={false}
          isBusy={false}
          onCancel={() => {}}
          onSave={() => {}}
        />,
      ),
    );

    expect(text).toContain(ROLE_CHANGE_REACH);
  });
});

describe('invitation form', () => {
  const form = (ownerUid: string) =>
    textOf(
      renderStatic(
        <InviteForm
          distributor={distributorOf('d-norte', { ownerUid })}
          actor={ACTOR}
          joinUrl="https://example.com/unirme"
          isOnline
          onCreated={() => {}}
          onClose={() => {}}
        />,
      ),
    );

  it('offers the founder the three roles and recommends tying it to an address', () => {
    const text = form(SESSION.uid);

    expect(text).toContain('Titular');
    expect(text).toContain('Central');
    expect(text).toContain('Reparto');
    expect(text).toContain('Correo de Google (opcional)');
    expect(text).toContain(EMAIL_RECOMMENDED);
  });

  it('does not offer a co-owner to invite another owner', () => {
    expect(form('u-fundadora')).not.toContain('Titular');
  });
});

describe('helpers', () => {
  const helper: Helper = {
    id: 'h00',
    name: 'P. Ayuda',
    active: true,
    createdAt: CREATED,
    updatedAt: CREATED,
  };
  const controls = { isLocked: false, busy: null, onRename: noop, onActive: noop };

  it('lets the owner rename a helper or switch it off', () => {
    const text = textOf(renderStatic(<HelperRow helper={helper} controls={controls} />));

    expect(text).toContain('Disponible');
    expect(text).toContain('Renombrar');
    expect(text).toContain('Desactivar');
  });

  it('only reads in a read-only distributor', () => {
    const text = textOf(
      renderStatic(<HelperRow helper={{ ...helper, active: false }} controls={null} />),
    );

    expect(text).toContain('No disponible');
    expect(text).not.toContain('Renombrar');
  });
});

describe('the staff on the office home', () => {
  it('turns "Suma a tu personal" into a real task', () => {
    const html = renderStatic(<SetupChecklist distributor={distributorOf('d-norte')} isListed />);

    expect(textOf(html)).toContain('Suma a tu personal');
    expect(hrefs(html)).toContain(ROUTES.officeStaff);
  });

  it('tells a co-owner that the note is read by whoever registered the distributor', () => {
    const status = (isFounder: boolean) =>
      textOf(
        renderStatic(
          <ListingStatus
            distributor={distributorOf('d-norte', {
              listingApproved: false,
              reviewNote: isFounder ? 'Revisa el RUC.' : null,
            })}
            listing="changesRequested"
            isOwner
            isFounder={isFounder}
          />,
        ),
      );

    expect(status(false)).toContain(NOTE_ELSEWHERE);
    expect(status(true)).toContain('Revisa el RUC.');
    expect(status(true)).not.toContain(NOTE_ELSEWHERE);
  });
});
