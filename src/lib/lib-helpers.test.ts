import { describe, expect, it } from 'vitest';
import { greetingFor } from './greeting';
import { documentTitleFor } from './page-title';
import { remainingVisibleMs } from './use-delayed-flag';

describe('remainingVisibleMs (motion-system §2: once shown, at least 400 ms)', () => {
  it.each([
    [1_000, 1_000, 400],
    [1_000, 1_150, 250],
    [1_000, 1_400, 0],
    [1_000, 9_000, 0],
  ])('shown at %d, now %d → %d ms more', (shownAtMs, nowMs, expected) => {
    expect(remainingVisibleMs(shownAtMs, nowMs)).toBe(expected);
  });
});

describe('documentTitleFor', () => {
  it('puts the screen first and the product after', () => {
    expect(documentTitleFor('Ingresar')).toBe('Ingresar · Hornilla');
  });

  it('falls back to the product name', () => {
    expect(documentTitleFor('')).toBe('Hornilla');
  });
});

// role-walker 2026-10-11: "Hola, Z.. ¿Quién te lleva…" for a name that ends in a full stop.
describe('greetingFor', () => {
  it.each([
    ['Persona Demo', 'Hola, Persona.'],
    ['  Ñandú   Pérez ', 'Hola, Ñandú.'],
    ['Z. Prueba', 'Hola, Z.'],
    ['¡Eh! Demo', 'Hola, ¡Eh!'],
    ['', 'Hola.'],
    ['   ', 'Hola.'],
    [undefined, 'Hola.'],
    [null, 'Hola.'],
  ])('greets %j with "%s"', (displayName, expected) => {
    expect(greetingFor(displayName)).toBe(expected);
  });
});
