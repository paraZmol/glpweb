import { describe, expect, it } from 'vitest';
import { publicDistributorOf } from '../../../tests/support/account-fixtures';
import type { DistributorProfilePatch } from '../../domain/tenancy/distributor-input';
import { InvalidInputError, PermissionDeniedError } from '../../domain/tenancy/errors';
import { touchesIdentity } from '../../domain/tenancy/listing';
import {
  hasChanges,
  profileEditErrorsOf,
  profileEditFormOf,
  profilePatchOf,
  toggleDay,
  validateProfileEdit,
} from './profile-edit';

const STORED = publicDistributorOf();
const FORM = profileEditFormOf(STORED);

// PLAN 2.11: the owner edits the public profile; only what changed travels.
describe('profilePatchOf', () => {
  it('is empty for a form nobody touched', () => {
    const patch = profilePatchOf(FORM, STORED);

    expect(patch).toEqual({});
    expect(hasChanges(patch)).toBe(false);
  });

  it.each([
    ['a phone typed with spaces', { contactPhone: '900 000 011' }],
    ['a name with spaces around', { name: '  Gas Demo Norte ' }],
    ['the colour in capitals', { brandColor: '#E11D48' }],
    ['the days in another order', { days: [6, 5, 4, 3, 2, 1] }],
    ['the address with spaces around', { addressLine: ' Av. Demo 123 ' }],
  ])('does not count %s as a change', (_case, change) => {
    expect(profilePatchOf({ ...FORM, ...change }, STORED)).toEqual({});
  });

  it.each([
    ['name', { name: 'Gas Demo Centro' }, true],
    ['contactPhone', { contactPhone: '900000012' }, true],
    ['whatsapp', { whatsapp: '900000013' }, true],
    ['addressLine', { addressLine: 'Jr. Demo 456' }, true],
    ['coverageRadiusKm', { coverageRadiusKm: 8 }, false],
    ['brandColor', { brandColor: '#1f2937' }, false],
  ] as const)('carries only %s when only it changed', (field, change, isIdentity) => {
    const patch = profilePatchOf({ ...FORM, ...change }, STORED);

    expect(Object.keys(patch)).toEqual([field]);
    expect(touchesIdentity(patch)).toBe(isIdentity);
  });

  it.each([
    ['a day less', { days: [1, 2, 3, 4, 5] }],
    ['another opening time', { opensAt: '06:30' }],
    ['another closing time', { closesAt: '21:00' }],
  ])('carries the whole schedule for %s, which does not send it back to review', (_c, change) => {
    const form = { ...FORM, ...change };
    const patch = profilePatchOf(form, STORED);

    expect(patch).toEqual({
      schedule: { days: form.days, opensAt: form.opensAt, closesAt: form.closesAt },
    });
    expect(touchesIdentity(patch)).toBe(false);
  });

  it('never carries an identity field that did not change, whatever else did', () => {
    const patch = profilePatchOf({ ...FORM, coverageRadiusKm: 9, brandColor: '#1f2937' }, STORED);

    expect(touchesIdentity(patch)).toBe(false);
  });
});

describe('toggleDay', () => {
  it('adds a day in the order of the week and removes one that was there', () => {
    expect(toggleDay([1, 3], 2)).toEqual([1, 2, 3]);
    expect(toggleDay([1, 2, 3], 2)).toEqual([1, 3]);
    expect(toggleDay([], 0)).toEqual([0]);
  });
});

describe('validateProfileEdit', () => {
  it('accepts a valid change', () => {
    expect(validateProfileEdit({ contactPhone: '900 000 012', coverageRadiusKm: 8 })).toEqual({});
  });

  it.each([
    [{ name: ' ' }, 'name', 'Escribe el nombre de tu distribuidora, con al menos 2 letras.'],
    [
      { contactPhone: '12345' },
      'contactPhone',
      'Escribe un celular de 9 dígitos que empiece en 9.',
    ],
    [{ whatsapp: '' }, 'whatsapp', 'Completa este dato.'],
    [
      { schedule: { days: [], opensAt: '07:00', closesAt: '20:00' } },
      'schedule',
      'Elige al menos un día y escribe la hora de apertura y la de cierre.',
    ],
    [
      { schedule: { days: [1], opensAt: '', closesAt: '20:00' } },
      'schedule',
      'Elige al menos un día y escribe la hora de apertura y la de cierre.',
    ],
    [{ brandColor: 'rojo' }, 'brandColor', 'Elige un color válido.'],
  ] satisfies [DistributorProfilePatch, string, string][])(
    'explains %j next to its field',
    (patch, field, message) => {
      expect(validateProfileEdit(patch)).toEqual({ [field]: message });
    },
  );

  it('refuses a colour the background swallows', () => {
    expect(validateProfileEdit({ brandColor: '#ffffff' }).brandColor).toMatch(
      /casi no se distingue/,
    );
  });
});

describe('profileEditErrorsOf', () => {
  it('paints the fields the repository rejected', () => {
    const error = new InvalidInputError([{ field: 'whatsapp', code: 'invalid' }]);

    expect(Object.keys(profileEditErrorsOf(error))).toEqual(['whatsapp']);
  });

  it('explains a refusal of the rules for the whole form', () => {
    expect(profileEditErrorsOf(new PermissionDeniedError()).form).toBe(
      'No tienes permiso para hacer esto, o la distribuidora está en solo lectura.',
    );
  });
});
