import { describe, expect, it } from 'vitest';
import { contactEmailOf } from './legal-contact';
import { parseLegalDocument } from './legal-markdown';

const termsWith = (contactLine: string) =>
  parseLegalDocument(
    [
      '# Términos',
      '',
      '## 1. Qué es',
      'Una plataforma.',
      '',
      contactLine,
      '',
      '## 2. Otra sección',
      'Texto.',
    ].join('\n'),
  );

// PLAN 2.9: "Contacto y reclamos" shows the address of the terms, and never invents one.
describe('contactEmailOf', () => {
  it('reads the address the terms publish', () => {
    const terms = termsWith('Titular: Demo S. A. C., RUC 0. Contacto: Hola@Example.com.');

    expect(contactEmailOf(terms)).toBe('hola@example.com');
  });

  it.each([
    ['a placeholder in brackets', 'Titular: [razón social]. Contacto: [correo de contacto].'],
    ['a bracketed address', 'Contacto: [hola@example.com].'],
    ['no contact line at all', 'Titular: Demo S. A. C.'],
    ['a word that is not an address', 'Contacto: pendiente.'],
  ])('has nothing to show with %s', (_case, line) => {
    expect(contactEmailOf(termsWith(line))).toBeNull();
  });

  it('ignores addresses that are not the contact one', () => {
    const terms = termsWith('Escribe a otra@example.com si quieres. Contacto: [correo].');

    expect(contactEmailOf(terms)).toBeNull();
  });
});
