import { describe, expect, it } from 'vitest';
import {
  checkComplaintsBookUrl,
  complaintsBookHostOf,
  isComplaintsBookUrl,
  normalizeComplaintsBookUrl,
} from './complaints-book';
import { COMPLAINTS_BOOK_URL_MAX_LENGTH } from './constants';

const LONGEST = `https://example.com/${'a'.repeat(COMPLAINTS_BOOK_URL_MAX_LENGTH - 20)}`;

describe('isComplaintsBookUrl', () => {
  it.each([
    'https://example.com',
    'https://example.com/',
    'https://libro.example.com/reclamaciones?empresa=Gas-Demo&ruc=20000000001',
    'https://example.com/libro#formulario',
    'https://a.pe',
    'https://example.com/xn--libro',
    'https://libroxn--a.example.com',
    LONGEST,
  ])('accepts %s', (url) => {
    expect(isComplaintsBookUrl(url)).toBe(true);
  });

  it.each([
    ['plain http', 'http://example.com/libro'],
    ['another scheme', 'javascript:alert(1)'],
    ['no scheme', 'example.com/libro'],
    ['a host without a dot', 'https://localhost/libro'],
    ['a host in capitals', 'https://Example.com/libro'],
    ['a host that ends in a hyphen', 'https://example-.com'],
    ['credentials before the host', 'https://user@example.com'],
    ['a port', 'https://example.com:8443/libro'],
    ['a space', 'https://example.com/libro de reclamos'],
    ['a quote', 'https://example.com/"libro"'],
    ['an angle bracket', 'https://example.com/<libro>'],
    ['an apostrophe', "https://example.com/libro'"],
    ['a letter outside ASCII in the host', 'https://reclamación.pe'],
    ['an invisible character', 'https://example.com/\u200blibro'],
    ['a line break', 'https://example.com/\nlibro'],
    ['a host in punycode', 'https://xn--reclamacin-6db.pe/libro'],
    ['a punycode label inside the host', 'https://libro.xn--80ak6aa92e.com'],
    ['one character too many', `${LONGEST}a`],
  ])('refuses %s', (_case, url) => {
    expect(isComplaintsBookUrl(url)).toBe(false);
  });
});

describe('normalizeComplaintsBookUrl', () => {
  it('trims and lowers the scheme and the host, never the path', () => {
    expect(normalizeComplaintsBookUrl('  HTTPS://Example.COM/Libro?Id=AB  ')).toBe(
      'https://example.com/Libro?Id=AB',
    );
  });

  it('reads an empty field as no link', () => {
    expect(normalizeComplaintsBookUrl('   ')).toBeNull();
  });
});

describe('checkComplaintsBookUrl', () => {
  it.each([
    [null, null],
    ['https://example.com/libro', null],
    ['http://example.com/libro', 'invalid'],
    [`${LONGEST}a`, 'tooLong'],
  ])('checks %s as %s', (url, expected) => {
    expect(checkComplaintsBookUrl(url)).toBe(expected);
  });
});

describe('complaintsBookHostOf', () => {
  it.each([
    ['https://reclamos.ejemplo.pe', 'reclamos.ejemplo.pe'],
    ['https://reclamos.ejemplo.pe/libro?empresa=1', 'reclamos.ejemplo.pe'],
    ['https://a.pe#formulario', 'a.pe'],
    ['https://a.pe?x=1', 'a.pe'],
  ])('reads the host of %s as %s', (url, host) => {
    expect(complaintsBookHostOf(url)).toBe(host);
  });

  it('reads nothing from something that is not such a link', () => {
    expect(complaintsBookHostOf('javascript:alert(1)')).toBe('');
  });
});
