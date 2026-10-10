import { describe, expect, it } from 'vitest';
import {
  ADDRESS_SLOT_IDS,
  type AddressInput,
  firstFreeAddressSlot,
  prepareAddress,
  prepareUserProfile,
  type UserProfileInput,
} from './account-input';
import { MAX_ADDRESSES_PER_USER } from './constants';

describe('prepareUserProfile', () => {
  function issuesOf(input: UserProfileInput) {
    const result = prepareUserProfile(input);
    return result.ok ? [] : result.issues.map((issue) => `${issue.field}:${issue.code}`);
  }

  it('trims the name and normalises the phone', () => {
    expect(prepareUserProfile({ displayName: '  C. Ñahui ', phone: '+51 900 000 010' })).toEqual({
      ok: true,
      value: { displayName: 'C. Ñahui', phone: '900000010' },
    });
  });

  it.each([undefined, null, ''])('treats phone %o as no phone', (phone) => {
    const result = prepareUserProfile({ displayName: 'C. Cliente', phone });
    expect(result.ok && result.value.phone).toBeNull();
  });

  it.each<[string, UserProfileInput, string]>([
    ['blank name', { displayName: '   ' }, 'displayName:required'],
    ['very long name', { displayName: 'n'.repeat(81) }, 'displayName:tooLong'],
    ['landline', { displayName: 'C.', phone: '012345678' }, 'phone:invalid'],
  ])('rejects %s', (_case, input, expected) => {
    expect(issuesOf(input)).toEqual([expected]);
  });
});

describe('prepareAddress', () => {
  const VALID: AddressInput = {
    label: ' Casa ',
    addressLine: ' Calle Uno 123 ',
    location: { lat: -12.0464, lng: -77.0428 },
  };

  function issuesOf(input: AddressInput) {
    const result = prepareAddress(input);
    return result.ok ? [] : result.issues.map((issue) => `${issue.field}:${issue.code}`);
  }

  it('trims the texts and defaults the reference to empty', () => {
    expect(prepareAddress(VALID)).toEqual({
      ok: true,
      value: {
        label: 'Casa',
        addressLine: 'Calle Uno 123',
        reference: '',
        location: VALID.location,
      },
    });
  });

  it.each<[string, Partial<AddressInput>, string]>([
    ['blank label', { label: ' ' }, 'label:required'],
    ['very long label', { label: 'l'.repeat(41) }, 'label:tooLong'],
    ['blank address', { addressLine: '' }, 'addressLine:required'],
    ['very long address', { addressLine: 'a'.repeat(161) }, 'addressLine:tooLong'],
    ['very long reference', { reference: 'r'.repeat(161) }, 'reference:tooLong'],
    ['latitude out of range', { location: { lat: -91, lng: 0 } }, 'location:invalid'],
    ['longitude out of range', { location: { lat: 0, lng: 181 } }, 'location:invalid'],
    ['NaN coordinate', { location: { lat: Number.NaN, lng: 0 } }, 'location:invalid'],
  ])('rejects %s', (_case, change, expected) => {
    expect(issuesOf({ ...VALID, ...change })).toEqual([expected]);
  });
});

describe('address slots', () => {
  it('has one slot per allowed address', () => {
    expect(ADDRESS_SLOT_IDS).toHaveLength(MAX_ADDRESSES_PER_USER);
    expect(ADDRESS_SLOT_IDS[0]).toBe('a0');
    expect(ADDRESS_SLOT_IDS.at(-1)).toBe('a9');
  });

  it('picks the first free slot, reusing gaps', () => {
    expect(firstFreeAddressSlot([])).toBe('a0');
    expect(firstFreeAddressSlot(['a0', 'a2'])).toBe('a1');
  });

  it('returns null when every slot is used', () => {
    expect(firstFreeAddressSlot(ADDRESS_SLOT_IDS)).toBeNull();
  });
});
