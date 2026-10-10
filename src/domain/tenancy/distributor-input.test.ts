import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BRAND_COLOR,
  DEFAULT_COVERAGE_RADIUS_KM,
  DEFAULT_SCHEDULE,
  MAX_BRANDS,
  MAX_PRICE_CENTS,
} from './constants';
import {
  type DistributorProfilePatch,
  type NewDistributorInput,
  prepareNewDistributor,
  prepareProfilePatch,
} from './distributor-input';

const VALID: NewDistributorInput = {
  name: '  Gas Demo A  ',
  slug: 'Gas Demo A',
  contactPhone: '+51 900 000 001',
  addressLine: ' Av. Principal 100 ',
  plant: { lat: -12.0464, lng: -77.0428 },
  ownerName: ' A. Dueña ',
  ownerPhone: '900000002',
};

function issuesOf(input: NewDistributorInput) {
  const result = prepareNewDistributor(input);
  return result.ok ? [] : result.issues.map((issue) => `${issue.field}:${issue.code}`);
}

describe('prepareNewDistributor', () => {
  it('normalises the form and fills the defaults', () => {
    const result = prepareNewDistributor(VALID);

    expect(result).toEqual({
      ok: true,
      value: {
        name: 'Gas Demo A',
        slug: 'gas-demo-a',
        contactPhone: '900000001',
        whatsapp: '900000001',
        addressLine: 'Av. Principal 100',
        plant: VALID.plant,
        coverageRadiusKm: DEFAULT_COVERAGE_RADIUS_KM,
        brandColor: DEFAULT_BRAND_COLOR,
        ownerName: 'A. Dueña',
        ownerPhone: '900000002',
      },
    });
  });

  it('keeps an explicit WhatsApp number, radius and colour', () => {
    const result = prepareNewDistributor({
      ...VALID,
      whatsapp: '900 000 003',
      coverageRadiusKm: 12.5,
      brandColor: '#0A7CFF',
    });

    expect(result.ok && result.value.whatsapp).toBe('900000003');
    expect(result.ok && result.value.coverageRadiusKm).toBe(12.5);
    expect(result.ok && result.value.brandColor).toBe('#0a7cff');
  });

  it.each<[string, Partial<NewDistributorInput>, string]>([
    ['empty name', { name: '   ' }, 'name:required'],
    ['one-letter name', { name: 'G' }, 'name:tooShort'],
    ['very long name', { name: 'G'.repeat(61) }, 'name:tooLong'],
    ['reserved slug', { slug: 'admin' }, 'slug:reserved'],
    ['short slug', { slug: 'ab' }, 'slug:tooShort'],
    ['emoji-only slug', { slug: '🔥' }, 'slug:tooShort'],
    ['landline as contact', { contactPhone: '012345678' }, 'contactPhone:invalid'],
    ['missing contact phone', { contactPhone: '' }, 'contactPhone:required'],
    ['bad WhatsApp', { whatsapp: '12345' }, 'whatsapp:invalid'],
    ['very long address', { addressLine: 'x'.repeat(161) }, 'addressLine:tooLong'],
    ['plant off the globe', { plant: { lat: 95, lng: 0 } }, 'plant:invalid'],
    ['zero radius', { coverageRadiusKm: 0 }, 'coverageRadiusKm:outOfRange'],
    ['negative radius', { coverageRadiusKm: -1 }, 'coverageRadiusKm:outOfRange'],
    ['huge radius', { coverageRadiusKm: 51 }, 'coverageRadiusKm:outOfRange'],
    ['NaN radius', { coverageRadiusKm: Number.NaN }, 'coverageRadiusKm:outOfRange'],
    ['short colour', { brandColor: '#fff' }, 'brandColor:invalid'],
    ['empty owner name', { ownerName: ' ' }, 'ownerName:required'],
    ['bad owner phone', { ownerPhone: '800000001' }, 'ownerPhone:invalid'],
  ])('rejects %s', (_case, change, expected) => {
    expect(issuesOf({ ...VALID, ...change })).toEqual([expected]);
  });

  it('reports every problem at once', () => {
    const issues = issuesOf({ ...VALID, name: '', slug: 'api', ownerPhone: '1' });
    expect(issues).toEqual(['name:required', 'slug:reserved', 'ownerPhone:invalid']);
  });
});

describe('prepareProfilePatch', () => {
  function patchIssues(patch: DistributorProfilePatch) {
    const result = prepareProfilePatch(patch);
    return result.ok ? [] : result.issues.map((issue) => `${issue.field}:${issue.code}`);
  }

  it('accepts an empty patch', () => {
    expect(prepareProfilePatch({})).toEqual({ ok: true, value: {} });
  });

  it('normalises the fields it receives and nothing else', () => {
    const result = prepareProfilePatch({
      name: ' Gas Demo B ',
      brands: [' Marca Uno ', 'Marca Dos'],
      brandColor: '#ABCDEF',
    });

    expect(result).toEqual({
      ok: true,
      value: { name: 'Gas Demo B', brands: ['Marca Uno', 'Marca Dos'], brandColor: '#abcdef' },
    });
  });

  it('drops fields an owner may not edit', () => {
    const hostile = { name: 'Gas Demo', status: 'active', slug: 'otro', ownerUid: 'x' };
    const result = prepareProfilePatch(hostile as DistributorProfilePatch);

    expect(result).toEqual({ ok: true, value: { name: 'Gas Demo' } });
  });

  it('accepts the default schedule, a price and clearing the price', () => {
    const schedule = { ...DEFAULT_SCHEDULE, days: [...DEFAULT_SCHEDULE.days] };
    expect(patchIssues({ schedule, priceFromCents: 3800, maxCylindersPerOrder: 5 })).toEqual([]);
    expect(patchIssues({ priceFromCents: null })).toEqual([]);
  });

  it.each<[string, DistributorProfilePatch, string]>([
    [
      'no days',
      { schedule: { days: [], opensAt: '07:00', closesAt: '20:00' } },
      'schedule:invalid',
    ],
    [
      'unknown day',
      { schedule: { days: [7], opensAt: '07:00', closesAt: '20:00' } },
      'schedule:invalid',
    ],
    [
      'repeated day',
      { schedule: { days: [1, 1], opensAt: '07:00', closesAt: '20:00' } },
      'schedule:invalid',
    ],
    [
      'bad time',
      { schedule: { days: [1], opensAt: '7am', closesAt: '20:00' } },
      'schedule:invalid',
    ],
    ['zero cylinders', { maxCylindersPerOrder: 0 }, 'maxCylindersPerOrder:outOfRange'],
    ['too many cylinders', { maxCylindersPerOrder: 21 }, 'maxCylindersPerOrder:outOfRange'],
    ['fractional cylinders', { maxCylindersPerOrder: 2.5 }, 'maxCylindersPerOrder:invalid'],
    [
      'too many brands',
      { brands: Array.from({ length: MAX_BRANDS + 1 }, (_, i) => `M${i}`) },
      'brands:tooLong',
    ],
    ['blank brand', { brands: ['  '] }, 'brands:invalid'],
    ['very long brand', { brands: ['m'.repeat(31)] }, 'brands:invalid'],
    ['float price', { priceFromCents: 38.5 }, 'priceFromCents:invalid'],
    ['zero price', { priceFromCents: 0 }, 'priceFromCents:outOfRange'],
    ['negative price', { priceFromCents: -100 }, 'priceFromCents:outOfRange'],
    ['absurd price', { priceFromCents: MAX_PRICE_CENTS + 1 }, 'priceFromCents:outOfRange'],
  ])('rejects %s', (_case, patch, expected) => {
    expect(patchIssues(patch)).toEqual([expected]);
  });
});
