/** Wait between two verification e-mails, so a nervous thumb does not hit the provider's limit. */
export const RESEND_WAIT_SECONDS = 60;

const MS_PER_SECOND = 1000;
const SENT_AT = 'verificationSentAtMs';

/**
 * Told to the verification screen through the navigation state: a verification e-mail left at
 * `nowMs`. The moment travels instead of a "just registered" mark so that reloading the screen
 * continues the wait instead of starting it again. It lives where the destination of the pending
 * steps already lives (the history entry of this tab): no storage of its own.
 */
export function verificationSentState(nowMs: number): Record<typeof SENT_AT, number> {
  return { [SENT_AT]: nowMs };
}

/** Seconds left before another e-mail may be asked for; 0 when the state says nothing usable. */
export function resendWaitLeft(state: unknown, nowMs: number): number {
  if (typeof state !== 'object' || state === null || !(SENT_AT in state)) return 0;
  const sentAtMs = state[SENT_AT];
  if (typeof sentAtMs !== 'number' || !Number.isFinite(sentAtMs)) return 0;
  // A moment in the future is a clock that changed: it never makes the wait longer than one turn.
  const elapsedSeconds = Math.max(0, (nowMs - sentAtMs) / MS_PER_SECOND);
  return Math.max(0, Math.ceil(RESEND_WAIT_SECONDS - elapsedSeconds));
}
