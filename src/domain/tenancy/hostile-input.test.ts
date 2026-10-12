// Hostile input against the tenancy validators: look-alike characters, invisible ones, values of
// the wrong type that reach the functions at run time, and edges of every range.
import { describe, expect, it } from 'vitest';
import { prepareAddress, prepareUserProfile } from './account-input';
import {
  isValidBrandColor,
  isValidPeruvianMobile,
  isValidTimeOfDay,
  normalizeBrandColor,
  normalizePeruvianMobile,
} from './contact';
import {
  type NewDistributorInput,
  prepareNewDistributor,
  prepareProfilePatch,
} from './distributor-input';
import { hasAnyRole, pickCurrentMembership } from './membership';
import {
  isValidSlug,
  normalizeSlug,
  RESERVED_SLUGS,
  SLUG_MAX_LENGTH,
  slugFromName,
  validateSlug,
} from './slug';
import type { Member } from './types';

const SLUG_SHAPE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CYRILLIC_A = 'а';
const ZERO_WIDTH_SPACE = '​';
const RIGHT_TO_LEFT_OVERRIDE = '‮';
const NO_BREAK_SPACE = ' ';

const HOSTILE_TEXTS = [
  `g${CYRILLIC_A}s-demo`,
  'ｇａｓ demo',
  `gas${ZERO_WIDTH_SPACE}demo`,
  `${RIGHT_TO_LEFT_OVERRIDE}omed sag`,
  'gaś́́́',
  'İstanbul Gaz',
  'GAS\tDEMO\r\n',
  '../../admin',
  'admin/../x',
  '%2e%2e%2fadmin',
  '<script>alert(1)</script>',
  "'; DROP TABLE slugs; --",
  '__proto__',
  'constructor',
  '\u0000gas\u0000',
  'a'.repeat(100_000),
  '-'.repeat(1000),
  '🔥'.repeat(50),
  '\ud800',
];

describe('slugs — hostile text', () => {
  it.each(HOSTILE_TEXTS)('normalises %j to slug shape or to nothing', (raw) => {
    const slug = normalizeSlug(raw);

    expect(slug === '' || SLUG_SHAPE.test(slug)).toBe(true);
    expect(slug.length).toBeLessThanOrEqual(SLUG_MAX_LENGTH);
    expect(normalizeSlug(slug)).toBe(slug);
  });

  it.each(HOSTILE_TEXTS)('suggests for %j a valid slug or nothing', (raw) => {
    const slug = slugFromName(raw);

    expect(slug === '' || isValidSlug(slug)).toBe(true);
  });

  it.each([
    ['a Cyrillic look-alike', `g${CYRILLIC_A}s-demo`],
    ['full-width letters', 'ｇａｓ-demo'],
    ['a zero-width space', `gas${ZERO_WIDTH_SPACE}-demo`],
    ['a right-to-left override', `${RIGHT_TO_LEFT_OVERRIDE}gas-demo`],
    ['a combining accent', 'gaś-demo'],
    ['a line break at the end', 'gas-demo\n'],
    ['a line break at the start', '\ngas-demo'],
    ['a space at the end', 'gas-demo '],
    ['a no-break space', `gas${NO_BREAK_SPACE}demo`],
    ['upper case', 'GAS-DEMO'],
    ['a dotless i', 'gas-rapıdo'],
    ['a long s', 'gaſ-demo'],
    ['a null character', 'gas\u0000demo'],
    ['a percent escape', 'gas%2ddemo'],
  ])('refuses a slug with %s without normalising it', (_case, slug) => {
    expect(validateSlug(slug)).toBe('invalidCharacters');
  });

  it.each([...RESERVED_SLUGS])(
    'cannot reach the reserved slug "%s" by disguising it',
    (reserved) => {
      const disguises = [
        reserved.toUpperCase(),
        ` ${reserved} `,
        `${reserved}${ZERO_WIDTH_SPACE}`,
        `--${reserved}--`,
        `${reserved}\n`,
        `${reserved}́`,
        `${RIGHT_TO_LEFT_OVERRIDE}${reserved}`,
      ];
      for (const disguise of disguises) {
        // Either it is refused as written, or it normalises to the reserved word and is refused.
        expect(isValidSlug(disguise)).toBe(false);
        expect(isValidSlug(normalizeSlug(disguise))).toBe(false);
        expect(slugFromName(disguise)).not.toBe(reserved);
      }
    },
  );

  it('measures the length after normalising, so padding cannot push a slug past the limit', () => {
    const padded = `${'́'.repeat(500)}${'a'.repeat(SLUG_MAX_LENGTH + 20)}`;
    expect(normalizeSlug(padded)).toHaveLength(SLUG_MAX_LENGTH);
  });
});

describe('phones — hostile text', () => {
  it.each([
    ['a line break at the end', '900000001\n'],
    ['a line break at the start', '\n900000001'],
    ['a full-width digit', '９00000001'],
    ['Arabic-Indic digits after the nine', '9٠٠٠٠٠٠٠١'],
    ['a zero-width space', `9000${ZERO_WIDTH_SPACE}00001`],
    ['a sign', '-900000001'],
    ['an exponent', '9e8'],
    ['a decimal point', '900000001.0'],
    ['hexadecimal', '0x35a4e901'],
    ['two numbers', '900000001,900000002'],
  ])('refuses a phone with %s', (_case, phone) => {
    expect(isValidPeruvianMobile(phone)).toBe(false);
  });

  it.each([
    ['a zero-width space inside', `900${ZERO_WIDTH_SPACE}000001`],
    ['the prefix twice', '+51+51900000001'],
    ['letters between digits', '9a0b0c0d0e0f0g0h1'],
    ['an extension', '900000001 ext 5'],
    ['a right-to-left override', `${RIGHT_TO_LEFT_OVERRIDE}100000009`],
    ['ten digits after the prefix', '+519000000011'],
  ])('does not turn a phone with %s into a valid one', (_case, raw) => {
    expect(isValidPeruvianMobile(normalizePeruvianMobile(raw))).toBe(false);
  });

  it('accepts the usual ways of typing a number, no-break spaces included', () => {
    expect(normalizePeruvianMobile(`+51${NO_BREAK_SPACE}900${NO_BREAK_SPACE}000 001`)).toBe(
      '900000001',
    );
  });
});

describe('brand colour and time — hostile text', () => {
  it.each([
    '#D9480F',
    '#d94',
    '#d9480f\n',
    ' #d9480f',
    '#d9480f80',
    '#d9480g',
    '＃d9480f',
    'rgb(217,72,15)',
    'red',
    'var(--primary)',
    '#d9480f;background:url(//x)',
    'javascript:alert(1)',
  ])('refuses the colour %j as it is', (color) => {
    expect(isValidBrandColor(color)).toBe(false);
  });

  it.each(['#d94', '#D94', '#d9480f80', '#d9480f;x', 'rgb(0,0,0)', '＃d9480f'])(
    'does not turn %j into a storable colour',
    (raw) => {
      expect(isValidBrandColor(normalizeBrandColor(raw))).toBe(false);
      expect(prepareProfilePatch({ brandColor: raw }).ok).toBe(false);
    },
  );

  it('stores an upper-case colour with spaces around it in lower case', () => {
    expect(normalizeBrandColor(' #D9480F\n')).toBe('#d9480f');
    expect(prepareProfilePatch({ brandColor: ' #1F2937 ' })).toEqual({
      ok: true,
      value: { brandColor: '#1f2937' },
    });
  });

  it.each(['07:00\n', ' 07:00', '7:00', '07:0', '07:00:00', '24:00', '０７:00', '-7:00'])(
    'refuses the time %j',
    (value) => {
      expect(isValidTimeOfDay(value)).toBe(false);
    },
  );
});

describe('distributor profile — values of the wrong type or off the edge', () => {
  const accepted = (patch: Record<string, unknown>) => prepareProfilePatch(patch as never).ok;

  it.each([
    ['a blank name', { name: '   ' }],
    ['a name of no-break spaces', { name: NO_BREAK_SPACE.repeat(5) }],
    ['a name of line breaks', { name: '\n\n\n' }],
    ['a one-letter name padded with spaces', { name: '  G  ' }],
    ['a name of zero-width spaces', { name: ZERO_WIDTH_SPACE.repeat(4) }],
    ['a name that is only a right-to-left override', { name: RIGHT_TO_LEFT_OVERRIDE.repeat(2) }],
    ['a name of punctuation', { name: '......' }],
    ['a name of emoji', { name: '🔥🔥' }],
    ['a blank brand', { brands: ['Marca Uno', '  '] }],
    ['a repeated day', { schedule: { days: [1, 1], opensAt: '07:00', closesAt: '20:00' } }],
    ['a fractional day', { schedule: { days: [1.5], opensAt: '07:00', closesAt: '20:00' } }],
    ['a NaN radius', { coverageRadiusKm: Number.NaN }],
    ['an infinite radius', { coverageRadiusKm: Number.POSITIVE_INFINITY }],
    ['a radius as text', { coverageRadiusKm: '5' }],
    ['a radius just under the minimum', { coverageRadiusKm: 0.9999 }],
    ['a NaN plant', { plant: { lat: Number.NaN, lng: 0 } }],
    ['a plant with text coordinates', { plant: { lat: '-12', lng: '-77' } }],
    ['a plant just off the globe', { plant: { lat: -90.0000001, lng: 0 } }],
    ['cylinders as text', { maxCylindersPerOrder: '3' }],
    ['an enormous number of cylinders', { maxCylindersPerOrder: 1e21 }],
    ['a price of minus zero', { priceFromCents: -0 }],
    ['a price as text', { priceFromCents: '3800' }],
    ['a price in exponent form over the cap', { priceFromCents: 1e9 }],
  ])('refuses %s', (_case, patch) => {
    expect(accepted(patch)).toBe(false);
  });

  it.each(['Gas Demo', 'Ñandú', 'A1', '24 Horas', 'Gas & Más', '液化气'])(
    'accepts the name %j',
    (name) => {
      expect(accepted({ name })).toBe(true);
    },
  );

  it('drops keys that are not part of the profile, dangerous names included', () => {
    const hostile = JSON.parse(
      '{"name":"Gas Demo","__proto__":{"polluted":true},"constructor":1,"status":"active","ownerUid":"x","acceptingOrders":true,"slug":"otro"}',
    );
    const prepared = prepareProfilePatch(hostile);

    expect(prepared).toEqual({ ok: true, value: { name: 'Gas Demo' } });
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});

describe('founding form — hostile text', () => {
  const VALID: NewDistributorInput = {
    name: 'Gas Demo',
    slug: 'gas-demo',
    contactPhone: '900000001',
    addressLine: 'Av. Principal 100',
    plant: { lat: -12.0464, lng: -77.0428 },
    ownerName: 'A. Persona',
    ownerPhone: '900000002',
    taxId: '20000000001',
    legalName: 'Gas Demo S.A.C.',
    hydrocarbonsRegistry: '00000-074-000000',
  };
  const fieldsRefused = (change: Partial<NewDistributorInput>) => {
    const prepared = prepareNewDistributor({ ...VALID, ...change });
    return prepared.ok ? [] : prepared.issues.map((issue) => issue.field);
  };

  it('never stores a slug that is not in slug shape, whatever is typed', () => {
    for (const raw of HOSTILE_TEXTS) {
      const prepared = prepareNewDistributor({ ...VALID, slug: raw });
      if (prepared.ok) expect(isValidSlug(prepared.value.slug)).toBe(true);
    }
  });

  it.each([...RESERVED_SLUGS].slice(0, 8))(
    'refuses the reserved slug "%s" typed in capitals',
    (slug) => {
      expect(fieldsRefused({ slug: ` ${slug.toUpperCase()} ` })).toEqual(['slug']);
    },
  );

  it.each([
    ['a blank owner name', { ownerName: ' \t ' }, 'ownerName'],
    ['an owner phone in full-width digits', { ownerPhone: '９００000001' }, 'ownerPhone'],
    ['a contact phone with letters', { contactPhone: '9OOOOOOO1' }, 'contactPhone'],
    [
      'a WhatsApp number with a zero-width space',
      { whatsapp: `9000${ZERO_WIDTH_SPACE}00001` },
      'whatsapp',
    ],
    ['a name that is too long once trimmed', { name: ` ${'G'.repeat(61)} ` }, 'name'],
  ])('refuses %s', (_case, change, field) => {
    expect(fieldsRefused(change)).toContain(field);
  });
});

describe('account — hostile text', () => {
  it.each([
    ['a blank name', '   '],
    ['a name of no-break spaces', NO_BREAK_SPACE.repeat(3)],
    ['a name of line breaks', '\r\n\r\n'],
    ['a megabyte of text', 'n'.repeat(1_000_000)],
  ])('refuses a profile with %s', (_case, displayName) => {
    expect(prepareUserProfile({ displayName }).ok).toBe(false);
  });

  it.each([
    ['NaN', { lat: Number.NaN, lng: Number.NaN }],
    ['infinity', { lat: 0, lng: Number.POSITIVE_INFINITY }],
    ['text', { lat: '-12', lng: '-77' }],
    ['null', { lat: null, lng: null }],
    ['a point just off the globe', { lat: 0, lng: 180.0000001 }],
  ])('refuses an address located at %s', (_case, location) => {
    const prepared = prepareAddress({
      label: 'Casa',
      addressLine: 'Calle Uno 123',
      location: location as never,
    });
    expect(prepared.ok).toBe(false);
  });
});

describe('memberships — junk that comes back from the database', () => {
  const AT = new Date('2026-03-10T15:00:00Z');
  const member = (change: Record<string, unknown>): Member =>
    ({
      uid: 'u1',
      distributorId: 'dist-a',
      role: 'driver',
      active: true,
      displayName: 'D. Persona',
      distributorName: 'Gas Demo',
      createdAt: AT,
      updatedAt: AT,
      ...change,
    }) as Member;

  it('gives no role to a deactivated member or to one whose role is unknown', () => {
    expect(hasAnyRole(member({ active: false }), ['driver'])).toBe(false);
    expect(hasAnyRole(member({ role: 'admin' }), ['owner', 'dispatcher', 'driver'])).toBe(false);
    expect(hasAnyRole(member({ role: 'OWNER' }), ['owner'])).toBe(false);
  });

  it('never picks a deactivated membership, even when it is the remembered one', () => {
    const inactive = member({ distributorId: 'dist-a', role: 'owner', active: false });
    const active = member({ distributorId: 'dist-b' });

    expect(pickCurrentMembership([inactive, active], 'dist-a')).toBe(active);
    expect(pickCurrentMembership([inactive], 'dist-a')).toBeNull();
  });
});
