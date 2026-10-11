import { describe, expect, it } from 'vitest';
import {
  DistributorLimitError,
  InvalidInputError,
  OfflineError,
  SlugTakenError,
} from '../../domain/tenancy/errors';
import {
  emptyFoundingForm,
  firstStepWithProblems,
  type FoundingForm,
  foundingErrorsOf,
  plantOf,
  stepOfErrors,
  toFoundingInput,
  validateFoundingStep,
} from './founding-form';

// Invented data: the repository is public.
const OWNER = { displayName: 'Persona Demo', phone: '900000051' };
const COMPLETE: FoundingForm = {
  ...emptyFoundingForm(OWNER),
  name: 'Gas Demo Centro',
  slug: 'gas-demo-centro',
  contactPhone: '900 000 061',
  taxId: '20-00000000-1',
  legalName: 'Gas Demo Centro S.A.C.',
  hydrocarbonsRegistry: '00000-074-000008',
  latitude: '-8.1',
  longitude: '-79.03',
  acceptTerms: true,
  declaresAuthority: true,
};

// PLAN 2.2: the sign-up wizard of a distributor.
describe('emptyFoundingForm', () => {
  it('starts with the owner known, both boxes unticked and the defaults of a new distributor', () => {
    const form = emptyFoundingForm({ displayName: 'Persona Demo', phone: null });

    expect(form).toMatchObject({
      ownerName: 'Persona Demo',
      ownerPhone: '',
      coverageRadiusKm: 5,
      acceptTerms: false,
      declaresAuthority: false,
    });
  });
});

describe('plantOf', () => {
  it.each([
    [
      { latitude: '-12.0464', longitude: '-77.0428' },
      { lat: -12.0464, lng: -77.0428 },
    ],
    [
      { latitude: ' -12,05 ', longitude: '-77,04' },
      { lat: -12.05, lng: -77.04 },
    ],
  ])('reads %j', (typed, point) => {
    expect(plantOf(typed)).toEqual(point);
  });

  it('never reads an empty field as zero', () => {
    expect(plantOf({ latitude: '', longitude: '-77.04' }).lat).toBeNaN();
  });
});

describe('toFoundingInput', () => {
  it('leaves WhatsApp out when it is empty, so it follows the phone', () => {
    expect(toFoundingInput(COMPLETE).whatsapp).toBeUndefined();
    expect(toFoundingInput({ ...COMPLETE, whatsapp: '900000062' }).whatsapp).toBe('900000062');
  });
});

describe('validateFoundingStep', () => {
  it('finds nothing wrong in a complete form, step by step', () => {
    expect(validateFoundingStep('business', COMPLETE)).toEqual({});
    expect(validateFoundingStep('location', COMPLETE)).toEqual({});
    expect(validateFoundingStep('brand', COMPLETE)).toEqual({});
    expect(validateFoundingStep('review', COMPLETE)).toEqual({});
    expect(firstStepWithProblems(COMPLETE)).toBeNull();
  });

  it('only reports the fields of the step asked about', () => {
    const empty = emptyFoundingForm({ displayName: 'Persona Demo', phone: null });

    expect(Object.keys(validateFoundingStep('business', empty)).sort()).toEqual([
      'contactPhone',
      'hydrocarbonsRegistry',
      'legalName',
      'name',
      'ownerPhone',
      'slug',
      'taxId',
    ]);
    expect(Object.keys(validateFoundingStep('location', empty))).toEqual(['plant']);
    expect(validateFoundingStep('brand', empty)).toEqual({});
    expect(Object.keys(validateFoundingStep('review', empty))).toEqual([
      'acceptTerms',
      'declaresAuthority',
    ]);
  });

  it.each([
    ['business', { name: 'G' }, 'name'],
    ['business', { slug: 'ab' }, 'slug'],
    ['business', { slug: 'central' }, 'slug'],
    ['business', { contactPhone: '12345' }, 'contactPhone'],
    ['business', { whatsapp: '800000000' }, 'whatsapp'],
    // PLAN 2.11: the verification data belongs to the first step.
    ['business', { taxId: '20000000002' }, 'taxId'],
    ['business', { legalName: '' }, 'legalName'],
    ['business', { hydrocarbonsRegistry: '<1>' }, 'hydrocarbonsRegistry'],
    ['business', { ownerPhone: '' }, 'ownerPhone'],
    ['location', { latitude: '' }, 'plant'],
    ['location', { latitude: 'doce' }, 'plant'],
    ['location', { longitude: '-190' }, 'plant'],
    ['location', { coverageRadiusKm: 0 }, 'coverageRadiusKm'],
    ['location', { addressLine: 'x'.repeat(161) }, 'addressLine'],
    ['brand', { brandColor: 'naranja' }, 'brandColor'],
    ['brand', { brandColor: '#ffffff' }, 'brandColor'],
    ['review', { acceptTerms: false }, 'acceptTerms'],
    ['review', { declaresAuthority: false }, 'declaresAuthority'],
  ] as const)('on %s refuses %j', (step, patch, field) => {
    const errors = validateFoundingStep(step, { ...COMPLETE, ...patch });

    expect(Object.keys(errors)).toEqual([field]);
    expect(firstStepWithProblems({ ...COMPLETE, ...patch })).toBe(step);
  });

  it('asks for the plant without mentioning a map that does not exist yet', () => {
    const { plant = '' } = validateFoundingStep('location', { ...COMPLETE, longitude: '' });

    expect(plant).toContain('latitud');
    expect(plant).not.toMatch(/mapa/i);
  });
});

describe('foundingErrorsOf', () => {
  it('puts a link taken at the last moment next to its field, on the first step', () => {
    const errors = foundingErrorsOf(new SlugTakenError('gas-demo-centro'));

    expect(errors).toEqual({ slug: 'Ese enlace ya lo usa otra distribuidora.' });
    expect(stepOfErrors(errors)).toBe('business');
  });

  it('puts each refused field next to itself', () => {
    const errors = foundingErrorsOf(
      new InvalidInputError([
        { field: 'plant', code: 'invalid' },
        { field: 'acceptTerms', code: 'required' },
      ]),
    );

    expect(Object.keys(errors)).toEqual(['plant', 'acceptTerms']);
    expect(stepOfErrors(errors)).toBe('location');
  });

  it('says so on the form when the refused field is not on any step', () => {
    const errors = foundingErrorsOf(
      new InvalidInputError([{ field: 'ownerName', code: 'required' }]),
    );

    expect(errors).toEqual({ form: 'Revisa los datos marcados.' });
    expect(stepOfErrors(errors)).toBeNull();
  });

  it.each([
    [new DistributorLimitError(3), 'Una cuenta puede registrar hasta 3 distribuidoras.'],
    [new OfflineError(), 'No hay conexión. Vuelve a intentar cuando regrese.'],
    [new Error('boom'), 'No pudimos completar la acción. Vuelve a intentar.'],
  ])('explains %s on the form', (error, message) => {
    expect(foundingErrorsOf(error)).toEqual({ form: message });
  });
});
