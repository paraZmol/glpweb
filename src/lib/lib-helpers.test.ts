import { describe, expect, it } from 'vitest';
import { documentTitleFor } from './page-title';
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
