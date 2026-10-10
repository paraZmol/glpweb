import { describe, expect, it } from 'vitest';
import { formatPhone, telHref, whatsappHref } from './contact-links';

// PLAN 2.5: phone and WhatsApp links of the public page, built only from validated data.
describe('contact links', () => {
  it('formats a Peruvian mobile in groups of three', () => {
    expect(formatPhone('900000011')).toBe('900 000 011');
    expect(formatPhone('+51 900 000 011')).toBe('900 000 011');
    expect(formatPhone('01-555')).toBe('01-555');
  });

  it('builds the tel link with the country code', () => {
    expect(telHref('900000011')).toBe('tel:+51900000011');
  });

  it('builds the WhatsApp link, with the message encoded', () => {
    expect(whatsappHref('900000011')).toBe('https://wa.me/51900000011');
    expect(whatsappHref('900000011', 'Hola, ¿tienen gas? & más')).toBe(
      'https://wa.me/51900000011?text=Hola%2C%20%C2%BFtienen%20gas%3F%20%26%20m%C3%A1s',
    );
  });

  it.each(['', '12345', '800000011', '900000011?text=x', 'javascript:alert(1)'])(
    'builds no link from %j',
    (phone) => {
      expect(telHref(phone)).toBeNull();
      expect(whatsappHref(phone, 'hola')).toBeNull();
    },
  );
});
