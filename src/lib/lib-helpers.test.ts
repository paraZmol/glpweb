import { describe, expect, it } from 'vitest';
import { greetingFor } from './greeting';
import { documentTitleFor } from './page-title';
import { RESEND_WAIT_SECONDS, resendWaitLeft, verificationSentState } from './resend-wait';
import { formatCountdown, secondsUntil } from './use-countdown';
import { remainingVisibleMs } from './use-delayed-flag';

describe('formatCountdown', () => {
  it.each([
    [60, '1:00'],
    [59, '0:59'],
    [5, '0:05'],
    [0, '0:00'],
    [-4, '0:00'],
    [75, '1:15'],
    [0.2, '0:01'],
    [600, '10:00'],
  ])('shows %d s as %s', (seconds, expected) => {
    expect(formatCountdown(seconds)).toBe(expected);
  });
});

describe('secondsUntil', () => {
  it.each([
    [10_000, 0, 10],
    [10_000, 9_001, 1],
    [10_000, 9_999, 1],
    [10_000, 10_000, 0],
    [10_000, 25_000, 0],
  ])('from %d at %d there are %d s left', (endsAtMs, nowMs, expected) => {
    expect(secondsUntil(endsAtMs, nowMs)).toBe(expected);
  });
});

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

// role-walker 2026-10-11: reloading /verificar-correo started the wait again.
describe('resendWaitLeft', () => {
  const SENT_AT = 1_000_000;
  const sent = verificationSentState(SENT_AT);

  it.each([
    [0, RESEND_WAIT_SECONDS],
    [1, RESEND_WAIT_SECONDS],
    [20_000, 40],
    [59_500, 1],
    [60_000, 0],
    [3_600_000, 0],
  ])('%d ms after the e-mail left there are %d s to wait', (elapsedMs, expected) => {
    expect(resendWaitLeft(sent, SENT_AT + elapsedMs)).toBe(expected);
  });

  it('never waits longer than one turn when the clock went back', () => {
    expect(resendWaitLeft(sent, SENT_AT - 500_000)).toBe(RESEND_WAIT_SECONDS);
  });

  it.each([
    null,
    undefined,
    'texto',
    {},
    { after: '/inicio' },
    { verificationSentAtMs: '1000000' },
    { verificationSentAtMs: Number.NaN },
    { verificationSentAtMs: Number.POSITIVE_INFINITY },
  ])('does not wait for a state that says nothing usable: %j', (state) => {
    expect(resendWaitLeft(state, SENT_AT)).toBe(0);
  });
});
