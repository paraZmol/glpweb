/**
 * Motion tokens (skill motion-system §1). The only place where durations, curves and springs
 * are written; src/index.css mirrors them as `--motion-*` variables for CSS transitions, and
 * `motion.test.ts` fails when the two drift apart. Components never write a number of their own.
 */

/** Seconds, as `motion` expects them. */
export const DURATION = {
  instant: 0.1,
  fast: 0.15,
  base: 0.22,
  slow: 0.32,
  map: 0.9,
} as const;
export type DurationToken = keyof typeof DURATION;

export const EASE = {
  /** Everything that enters. */
  out: [0.22, 1, 0.36, 1],
  /** Everything that leaves. */
  in: [0.4, 0, 1, 1],
} as const;

/** What leaves does it faster than what enters. */
export const EXIT_SPEED = 0.7;

export const SPRING_TAP = { type: 'spring', stiffness: 500, damping: 30 } as const;

export const STAGGER = { stepSeconds: 0.04, maxItems: 8 } as const;

/** Loading feedback: nothing before 300 ms, and once shown it stays at least 400 ms. */
export const LOADING_FEEDBACK = { delayMs: 300, minVisibleMs: 400 } as const;

export const PRESS_SCALE = 0.97;
/** Direction B: the +/− stepper buttons press deeper than a regular button. */
export const STEPPER_PRESS_SCALE = 0.9;

const PAGE_SLIDE_PX = 24;
const LIST_RISE_PX = 8;
const SHAKE_PX = 6;
const BANNER_DROP = '-100%';

export function enterTransition(token: DurationToken) {
  return { duration: DURATION[token], ease: EASE.out };
}

export function exitTransition(token: DurationToken) {
  return { duration: DURATION[token] * EXIT_SPEED, ease: EASE.in };
}

/** Delay of the nth element of a list: 40 ms apart, and nothing waits longer than the 8th. */
export function staggerDelay(index: number): number {
  return Math.min(Math.max(index, 0), STAGGER.maxItems) * STAGGER.stepSeconds;
}

export type PageDirection = 'forward' | 'back' | 'fade';

const PAGE_OFFSET: Record<PageDirection, number> = {
  forward: PAGE_SLIDE_PX,
  back: -PAGE_SLIDE_PX,
  fade: 0,
};

/** Screen change. With reduced motion every direction becomes a short fade. */
export function pageVariants(direction: PageDirection, isReduced: boolean) {
  const offset = isReduced ? 0 : PAGE_OFFSET[direction];
  return {
    initial: { opacity: 0, x: offset },
    animate: { opacity: 1, x: 0, transition: enterTransition(isReduced ? 'fast' : 'slow') },
    // What leaves only fades: it must be out of the way before the next screen slides in.
    exit: { opacity: 0, transition: exitTransition('fast') },
  };
}

/** First appearance of a list element. */
export function listItemVariants(index: number, isReduced: boolean) {
  return {
    initial: { opacity: 0, y: isReduced ? 0 : LIST_RISE_PX },
    animate: {
      opacity: 1,
      y: 0,
      transition: { ...enterTransition(isReduced ? 'fast' : 'base'), delay: staggerDelay(index) },
    },
  };
}

/** Press feedback for anything tappable that is animated with `motion`. */
export function tapGesture(isReduced: boolean, scale: number = PRESS_SCALE) {
  return isReduced ? {} : { whileTap: { scale }, transition: SPRING_TAP };
}

/** Error: a short horizontal shake of the field or the button, always next to a message. */
export function shakeAnimation(isReduced: boolean) {
  if (isReduced) return { x: 0 };
  return {
    x: [0, -SHAKE_PX, SHAKE_PX, -SHAKE_PX, SHAKE_PX, 0],
    transition: enterTransition('slow'),
  };
}

/** "Sin conexión" banner: drops from the top edge. */
export function bannerVariants(isReduced: boolean) {
  return {
    initial: { opacity: 0, y: isReduced ? 0 : BANNER_DROP },
    animate: { opacity: 1, y: 0, transition: enterTransition(isReduced ? 'fast' : 'base') },
    exit: { opacity: 0, y: isReduced ? 0 : BANNER_DROP, transition: exitTransition('base') },
  };
}

/** Floating notice or card that rises into place. */
export function riseVariants(isReduced: boolean) {
  return {
    initial: { opacity: 0, y: isReduced ? 0 : LIST_RISE_PX },
    animate: { opacity: 1, y: 0, transition: enterTransition(isReduced ? 'fast' : 'base') },
    exit: { opacity: 0, y: isReduced ? 0 : LIST_RISE_PX, transition: exitTransition('base') },
  };
}

/** Direction B: the current step of the order timeline lands with a short bounce. */
export const STEP_BOUNCE = {
  scale: [0.8, 1.12, 1],
  times: [0, 0.6, 1],
  delaySeconds: 0.6,
} as const;

export function stepBounceAnimation(isReduced: boolean) {
  if (isReduced) return { scale: 1 };
  return {
    scale: [...STEP_BOUNCE.scale],
    transition: {
      ...enterTransition('slow'),
      times: [...STEP_BOUNCE.times],
      delay: STEP_BOUNCE.delaySeconds,
    },
  };
}

/** Direction B: only the active marker (own or assigned driver) pulses. One of two loops allowed. */
export const MARKER_PULSE = {
  scale: [0.6, 1.9],
  opacity: [0.55, 0],
  durationSeconds: 1.8,
  /** Still halo shown instead of the loop when motion is reduced. */
  reduced: { scale: 1.5, opacity: 0.25 },
} as const;

export function markerPulseAnimation(isReduced: boolean) {
  if (isReduced) return { ...MARKER_PULSE.reduced };
  return {
    scale: [...MARKER_PULSE.scale],
    opacity: [...MARKER_PULSE.opacity],
    transition: {
      duration: MARKER_PULSE.durationSeconds,
      ease: EASE.out,
      repeat: Number.POSITIVE_INFINITY,
    },
  };
}
