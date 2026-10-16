import { describe, expect, it } from 'vitest';
import { isCurrentLink, PUBLIC_NAV } from './public-nav';

describe('public menu (PLAN §11, 2026-10-16)', () => {
  it('lists the six links in order, with the sections as anchors of the home', () => {
    expect(PUBLIC_NAV.map((link) => link.label)).toEqual([
      'Inicio',
      'Qué es Hornilla',
      'Cómo funciona',
      'Seguridad',
      'Preguntas',
      'Para distribuidoras',
    ]);
    expect(PUBLIC_NAV.slice(1, 5).every((link) => link.to.startsWith('/#'))).toBe(true);
  });

  it('marks the page, and on the home the section, as current', () => {
    expect(isCurrentLink('/', '/', '')).toBe(true);
    expect(isCurrentLink('/', '/', '#seguridad')).toBe(false);
    expect(isCurrentLink('/#seguridad', '/', '#seguridad')).toBe(true);
    expect(isCurrentLink('/#seguridad', '/para-distribuidoras', '#seguridad')).toBe(false);
    expect(isCurrentLink('/para-distribuidoras', '/para-distribuidoras', '')).toBe(true);
  });
});
