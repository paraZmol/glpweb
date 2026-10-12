import { describe, expect, it } from 'vitest';
import {
  isValidSlug,
  normalizeSlug,
  RESERVED_SLUGS,
  SLUG_MAX_LENGTH,
  slugFromName,
  validateSlug,
} from './slug';

describe('normalizeSlug', () => {
  it.each([
    ['Gas Rápido', 'gas-rapido'],
    ['  Gas   del   Sur  ', 'gas-del-sur'],
    ['Señor Balón Ñandú', 'senor-balon-nandu'],
    ['GAS_100% & más!', 'gas-100-mas'],
    ['--gas--norte--', 'gas-norte'],
    ['Gas 🔥 Ya', 'gas-ya'],
    ['ÁÉÍÓÚÜ', 'aeiouu'],
    ['', ''],
    ['🔥🔥', ''],
  ])('%s → %s', (raw, expected) => {
    expect(normalizeSlug(raw)).toBe(expected);
  });

  it('cuts to the maximum length without leaving a hyphen at the end', () => {
    const slug = normalizeSlug(`${'a'.repeat(SLUG_MAX_LENGTH - 1)} bcd`);
    expect(slug).toBe('a'.repeat(SLUG_MAX_LENGTH - 1));
  });

  it('is idempotent', () => {
    const once = normalizeSlug('Distribuidora El Balón Feliz S.A.C.');
    expect(normalizeSlug(once)).toBe(once);
  });
});

describe('validateSlug', () => {
  it.each(['gas', 'gas-rapido', 'gas24', '24-horas', 'a1b', 'a'.repeat(SLUG_MAX_LENGTH)])(
    'accepts %s',
    (slug) => {
      expect(validateSlug(slug)).toBeNull();
      expect(isValidSlug(slug)).toBe(true);
    },
  );

  it.each([
    ['', 'tooShort'],
    ['ab', 'tooShort'],
    ['a'.repeat(SLUG_MAX_LENGTH + 1), 'tooLong'],
    ['Gas', 'invalidCharacters'],
    ['gas rapido', 'invalidCharacters'],
    ['gas_rapido', 'invalidCharacters'],
    ['-gas', 'invalidCharacters'],
    ['gas-', 'invalidCharacters'],
    ['gas--rapido', 'invalidCharacters'],
    ['gás', 'invalidCharacters'],
    ['gas/otro', 'invalidCharacters'],
    ['gas.x', 'invalidCharacters'],
    ['admin', 'reserved'],
    ['api', 'reserved'],
    ['plataforma', 'reserved'],
    ['ingresar', 'reserved'],
    ['registro', 'reserved'],
    // PLAN 2.11: the name of the platform is reserved anywhere in the link.
    ['hornilla-oficial', 'reserved'],
    ['gas-hornilla', 'reserved'],
    ['mihornilla2', 'reserved'],
    ['soporte-glpweb', 'reserved'],
    ['glpweb1', 'reserved'],
  ])('rejects "%s" as %s', (slug, issue) => {
    expect(validateSlug(slug)).toBe(issue);
    expect(isValidSlug(slug)).toBe(false);
  });

  it('rejects every reserved slug', () => {
    const accepted = RESERVED_SLUGS.filter((slug) => isValidSlug(slug));
    expect(accepted).toEqual([]);
  });

  it('keeps the reserved list in slug shape so the rules can compare it literally', () => {
    const malformed = RESERVED_SLUGS.filter((slug) => normalizeSlug(slug) !== slug);
    expect(malformed).toEqual([]);
  });
});

describe('slugFromName', () => {
  it.each([
    ['Gas Rápido', 'gas-rapido'],
    ['Distribuidora Ñañito', 'distribuidora-nanito'],
    ['El Peñón E.I.R.L.', 'el-penon-e-i-r-l'],
    ['Al', 'al-gas'],
    ['Admin', 'admin-gas'],
    ['Plataforma', 'plataforma-gas'],
    // Nothing built on the name of the platform is suggested.
    ['Hornilla', ''],
    ['Gas Hornilla Sur', ''],
    ['', ''],
    ['!!!', ''],
  ])('%s → %s', (name, expected) => {
    expect(slugFromName(name)).toBe(expected);
  });

  it('always suggests a valid slug or nothing', () => {
    const names = ['X', 'Gas', 'a'.repeat(80), 'ñ', 'Gas - - Sur', 'd'];
    const invalid = names.map(slugFromName).filter((slug) => slug !== '' && !isValidSlug(slug));
    expect(invalid).toEqual([]);
  });
});
