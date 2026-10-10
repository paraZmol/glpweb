import { useCallback, useEffect, useState } from 'react';

const TICK_MS = 1000;
const SECONDS_PER_MINUTE = 60;

/** `75` → "1:15". */
export function formatCountdown(totalSeconds: number): string {
  const seconds = Math.max(0, Math.ceil(totalSeconds));
  const rest = String(seconds % SECONDS_PER_MINUTE).padStart(2, '0');
  return `${Math.floor(seconds / SECONDS_PER_MINUTE)}:${rest}`;
}

/** Whole seconds left until `endsAtMs`, never negative. */
export function secondsUntil(endsAtMs: number, nowMs: number): number {
  return Math.max(0, Math.ceil((endsAtMs - nowMs) / TICK_MS));
}

/** A wait the person can see: `secondsLeft` goes down to 0 once `start(seconds)` is called. */
export function useCountdown(initialSeconds = 0) {
  const [endsAtMs, setEndsAtMs] = useState(() => Date.now() + initialSeconds * TICK_MS);
  const [secondsLeft, setSecondsLeft] = useState(initialSeconds);

  useEffect(() => {
    const tick = () => setSecondsLeft(secondsUntil(endsAtMs, Date.now()));
    tick();
    const timer = setInterval(tick, TICK_MS);
    return () => clearInterval(timer);
  }, [endsAtMs]);

  const start = useCallback((seconds: number) => {
    setSecondsLeft(seconds);
    setEndsAtMs(Date.now() + seconds * TICK_MS);
  }, []);

  return { secondsLeft, isRunning: secondsLeft > 0, start };
}
