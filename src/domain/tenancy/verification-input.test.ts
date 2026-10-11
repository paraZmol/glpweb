import { describe, expect, it } from 'vitest';
import { prepareBusinessVerification } from './verification-input';

const VALID = {
  taxId: '20000000001',
  legalName: 'Gas Demo Norte S.A.C.',
  hydrocarbonsRegistry: '00000-074-000000',
};

const issuesOf = (change: Partial<typeof VALID>) => {
  const result = prepareBusinessVerification({ ...VALID, ...change });
  return result.ok ? [] : result.issues.map((issue) => `${issue.field}:${issue.code}`);
};

describe('prepareBusinessVerification', () => {
  it('accepts well-formed data and normalises it', () => {
    const result = prepareBusinessVerification({
      taxId: ' 20-00000000-1 ',
      legalName: '  Gas   Demo Norte  S.A.C. ',
      hydrocarbonsRegistry: ' 00000-074-000000 a ',
    });

    expect(result).toEqual({
      ok: true,
      value: {
        taxId: '20000000001',
        legalName: 'Gas Demo Norte S.A.C.',
        hydrocarbonsRegistry: '00000-074-000000 A',
      },
    });
  });

  it.each([
    ['a missing RUC', { taxId: '' }, 'taxId:required'],
    ['a RUC with a wrong check digit', { taxId: '20000000002' }, 'taxId:invalid'],
    ['a DNI in place of the RUC', { taxId: '00000000' }, 'taxId:invalid'],
    ['a missing legal name', { legalName: '   ' }, 'legalName:required'],
    ['a one-letter legal name', { legalName: 'G' }, 'legalName:tooShort'],
    ['an oversized legal name', { legalName: 'G'.repeat(121) }, 'legalName:tooLong'],
    ['a missing record number', { hydrocarbonsRegistry: '' }, 'hydrocarbonsRegistry:required'],
    ['a record number too short', { hydrocarbonsRegistry: '12' }, 'hydrocarbonsRegistry:tooShort'],
    [
      'an oversized record number',
      { hydrocarbonsRegistry: '1'.repeat(41) },
      'hydrocarbonsRegistry:tooLong',
    ],
    [
      'a record number with markup',
      { hydrocarbonsRegistry: '<b>0001</b>' },
      'hydrocarbonsRegistry:invalid',
    ],
    [
      'a record number that ends in a separator',
      { hydrocarbonsRegistry: '00000-074-' },
      'hydrocarbonsRegistry:invalid',
    ],
    [
      'a record number with an accent',
      { hydrocarbonsRegistry: 'NÚM-0001' },
      'hydrocarbonsRegistry:invalid',
    ],
  ])('refuses %s', (_case, change, issue) => {
    expect(issuesOf(change)).toEqual([issue]);
  });

  it('reports every problem at once', () => {
    expect(issuesOf({ taxId: '1', legalName: '', hydrocarbonsRegistry: '' })).toEqual([
      'taxId:invalid',
      'legalName:required',
      'hydrocarbonsRegistry:required',
    ]);
  });
});
