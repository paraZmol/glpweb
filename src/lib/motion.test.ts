import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  DURATION,
  EASE,
  enterTransition,
  exitTransition,
  LOADING_FEEDBACK,
  MARKER_PULSE,
  markerPulseAnimation,
  pageVariants,
  PRESS_SCALE,
  shakeAnimation,
  SPRING_TAP,
  STAGGER,
  staggerDelay,
  STEP_BOUNCE,
  stepBounceAnimation,
  STEPPER_PRESS_SCALE,
  tapGesture,
} from './motion';

const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8');
const cssValue = (name: string) => new RegExp(`${name}:\\s*([^;]+);`).exec(css)?.[1]?.trim();
const milliseconds = (seconds: number) => `${Math.round(seconds * 1000)}ms`;
const bezier = (points: readonly number[]) => `cubic-bezier(${points.join(', ')})`;

describe('motion tokens (motion-system §1)', () => {
  it('keeps the values of the skill', () => {
    expect(DURATION).toEqual({ instant: 0.1, fast: 0.15, base: 0.22, slow: 0.32, map: 0.9 });
    expect(EASE).toEqual({ out: [0.22, 1, 0.36, 1], in: [0.4, 0, 1, 1] });
    expect(SPRING_TAP).toEqual({ type: 'spring', stiffness: 500, damping: 30 });
    expect(STAGGER).toEqual({ stepSeconds: 0.04, maxItems: 8 });
    expect(LOADING_FEEDBACK).toEqual({ delayMs: 300, minVisibleMs: 400 });
  });

  it.each(Object.entries(DURATION))('mirrors the %s duration in CSS', (token, seconds) => {
    expect(cssValue(`--motion-${token}`)).toBe(milliseconds(seconds));
  });

  it('mirrors curves, stagger and press scales in CSS', () => {
    expect(cssValue('--motion-ease-out')).toBe(bezier(EASE.out));
    expect(cssValue('--motion-ease-in')).toBe(bezier(EASE.in));
    expect(cssValue('--motion-stagger')).toBe(milliseconds(STAGGER.stepSeconds));
    expect(cssValue('--press-scale')).toBe(String(PRESS_SCALE));
    expect(cssValue('--press-scale-stepper')).toBe(String(STEPPER_PRESS_SCALE));
    expect(cssValue('--motion-pulse')).toBe(milliseconds(MARKER_PULSE.durationSeconds));
    expect(cssValue('--motion-step-bounce-delay')).toBe(milliseconds(STEP_BOUNCE.delaySeconds));
  });

  it('makes what leaves faster than what enters', () => {
    expect(enterTransition('slow')).toEqual({ duration: 0.32, ease: EASE.out });
    expect(exitTransition('slow').duration).toBeCloseTo(0.224, 5);
    expect(exitTransition('slow').ease).toBe(EASE.in);
  });
});

describe('staggerDelay', () => {
  it.each([
    [0, 0],
    [1, 0.04],
    [7, 0.28],
    [8, 0.32],
    [9, 0.32],
    [200, 0.32],
    [-1, 0],
  ])('element %i waits %d s', (index, expected) => {
    expect(staggerDelay(index)).toBeCloseTo(expected, 5);
  });
});

describe('pageVariants', () => {
  it('slides in from the right going into a detail and from the left coming back', () => {
    expect(pageVariants('forward', false).initial).toEqual({ opacity: 0, x: 24 });
    expect(pageVariants('back', false).initial).toEqual({ opacity: 0, x: -24 });
  });

  it('only cross-fades between sibling screens', () => {
    expect(pageVariants('fade', false).initial).toEqual({ opacity: 0, x: 0 });
  });

  it.each(['forward', 'back', 'fade'] as const)(
    'becomes a short fade with reduced motion (%s)',
    (direction) => {
      const variants = pageVariants(direction, true);

      expect(variants.initial).toEqual({ opacity: 0, x: 0 });
      expect(variants.exit).not.toHaveProperty('x');
      expect(variants.animate.transition.duration).toBeLessThanOrEqual(0.15);
    },
  );
});

describe('direction B adjustments (PLAN 2.4b)', () => {
  it('presses the stepper deeper than a regular button', () => {
    expect(PRESS_SCALE).toBe(0.97);
    expect(STEPPER_PRESS_SCALE).toBe(0.9);
    expect(tapGesture(false, STEPPER_PRESS_SCALE)).toEqual({
      whileTap: { scale: 0.9 },
      transition: SPRING_TAP,
    });
  });

  it('bounces the current step once', () => {
    const animation = stepBounceAnimation(false);

    expect(animation.scale).toEqual([0.8, 1.12, 1]);
    expect(animation).not.toHaveProperty('transition.repeat');
  });

  it('pulses the active marker in a loop', () => {
    expect(markerPulseAnimation(false)).toMatchObject({
      scale: [0.6, 1.9],
      opacity: [0.55, 0],
      transition: { duration: 1.8, repeat: Number.POSITIVE_INFINITY },
    });
  });

  it('stops scales, shakes and loops with reduced motion', () => {
    expect(tapGesture(true)).toEqual({});
    expect(stepBounceAnimation(true)).toEqual({ scale: 1 });
    expect(markerPulseAnimation(true)).toEqual({ scale: 1.5, opacity: 0.25 });
    expect(shakeAnimation(true)).toEqual({ x: 0 });
  });
});
