import { describe, expect, it } from 'vitest';
import {
  AlreadyMemberError,
  HelperLimitError,
  InviteExpiredError,
  InviteForAnotherAccountError,
  InviteNotFoundError,
  InviteRevokedError,
  InviteUsedError,
  MemberChangeNotAllowedError,
  UnreadableNameError,
} from '../../domain/staff/errors';
import { prepareInvite } from '../../domain/staff/invite-input';
import { InvalidInputError, PermissionDeniedError } from '../../domain/tenancy/errors';
import {
  describeJoinError,
  describeStaffError,
  inviteStateLabelOf,
  roleLabelOf,
  staffFieldMessagesOf,
} from './staff-messages';

describe('staff messages', () => {
  it('names the roles as the screens do', () => {
    expect([roleLabelOf('owner'), roleLabelOf('dispatcher'), roleLabelOf('driver')]).toEqual([
      'Titular',
      'Central',
      'Reparto',
    ]);
  });

  it('says why a co-owner cannot invite an owner', () => {
    const prepared = prepareInvite(
      { role: 'owner', email: 'socia@example.com' },
      {
        isFounder: false,
      },
    );
    expect(prepared.ok).toBe(false);
    const error = new InvalidInputError(prepared.ok ? [] : prepared.issues);

    expect(staffFieldMessagesOf(error)).toEqual({
      role: 'Solo quien registró la distribuidora puede invitar a otro titular.',
    });
  });

  it('asks for the Google address to invite an owner', () => {
    const prepared = prepareInvite({ role: 'owner' }, { isFounder: true });
    const error = new InvalidInputError(prepared.ok ? [] : prepared.issues);

    expect(staffFieldMessagesOf(error).email).toBe(
      'Para invitar a un titular escribe su correo de Google.',
    );
  });

  it.each([
    [new InviteNotFoundError(), 'No encontramos esta invitación'],
    [new InviteExpiredError(), 'Esta invitación venció: dura 7 días.'],
    [new InviteUsedError(), 'Esta invitación ya se usó.'],
    [new InviteRevokedError(), 'Esta invitación fue anulada.'],
    [new InviteForAnotherAccountError(), 'Esta invitación es para otra cuenta de Google.'],
    [new AlreadyMemberError(true), 'Ya formas parte de esta distribuidora.'],
    [new AlreadyMemberError(false), 'Pide a su titular que te vuelva a activar.'],
    [new UnreadableNameError(), 'Tu nombre en Hornilla no se puede leer.'],
    [new PermissionDeniedError(), 'No pudimos usar la invitación'],
  ])('explains a refused invitation (%s)', (error, text) => {
    expect(describeJoinError(error)).toContain(text);
  });

  it.each([
    ['self', 'No puedes cambiar tu propio rol ni desactivarte.'],
    ['founder', 'Quien registró la distribuidora siempre sigue como titular.'],
    ['ownersByFounderOnly', 'Solo quien registró la distribuidora puede cambiar a otro titular.'],
  ] as const)('explains a refused change of a member (%s)', (reason, text) => {
    expect(describeStaffError(new MemberChangeNotAllowedError(reason))).toBe(text);
  });

  it('gives the cap of helpers', () => {
    expect(describeStaffError(new HelperLimitError(30))).toBe(
      'Puedes tener hasta 30 ayudantes, también los desactivados.',
    );
  });

  it('labels every state of an invitation', () => {
    expect(inviteStateLabelOf('expired')).toBe('Venció');
  });
});
