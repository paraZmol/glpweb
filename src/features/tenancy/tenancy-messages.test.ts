import { describe, expect, it } from 'vitest';
import {
  AccountInUseError,
  DistributorLimitError,
  InvalidInputError,
  PermissionDeniedError,
  SlugTakenError,
} from '../../domain/tenancy/errors';
import { describeFieldIssue, describeTenancyError, fieldMessagesOf } from './tenancy-messages';

describe('describeFieldIssue', () => {
  it('prefers the message written for that field', () => {
    expect(describeFieldIssue({ field: 'contactPhone', code: 'invalid' })).toContain('9 dígitos');
    expect(describeFieldIssue({ field: 'slug', code: 'tooShort' })).toContain('al menos 3');
  });

  // PLAN 2.9
  it('explains a brand colour that cannot be seen and a missing privacy consent', () => {
    const faint = { field: 'brandColor', code: 'tooFaint', suggestion: '#c2410c' } as const;

    expect(describeFieldIssue(faint)).toContain('no se distingue del fondo');
    expect(describeFieldIssue({ field: 'acceptPrivacy', code: 'required' })).toContain(
      'política de privacidad',
    );
  });

  it('falls back to the generic message of the code', () => {
    expect(describeFieldIssue({ field: 'name', code: 'required' })).toBe('Completa este dato.');
    expect(describeFieldIssue({ field: 'slug', code: 'reserved' })).toContain('reservado');
  });
});

describe('fieldMessagesOf', () => {
  it('maps each rejected field to its message', () => {
    const error = new InvalidInputError([
      { field: 'name', code: 'required' },
      { field: 'ownerPhone', code: 'invalid' },
    ]);

    expect(Object.keys(fieldMessagesOf(error))).toEqual(['name', 'ownerPhone']);
  });

  it('is empty for any other error', () => {
    expect(fieldMessagesOf(new SlugTakenError('gas-demo'))).toEqual({});
  });
});

describe('describeTenancyError', () => {
  it.each([
    [new SlugTakenError('gas-demo'), 'otra distribuidora'],
    [new DistributorLimitError(3), 'hasta 3'],
    [new PermissionDeniedError(), 'solo lectura'],
    [new AccountInUseError(), 'Contacto'],
    [new Error('unexpected'), 'Vuelve a intentar'],
  ])('explains %o', (error, fragment) => {
    expect(describeTenancyError(error)).toContain(fragment);
  });
});
