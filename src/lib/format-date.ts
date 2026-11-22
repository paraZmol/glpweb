const LOCALE = 'es-PE';

/** "11 oct 2026, 3:30 p. m.", in the time zone of the reader's business. */
export function formatDateTime(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat(LOCALE, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone,
  }).format(date);
}

/** "11 oct 2026". */
export function formatDate(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat(LOCALE, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone,
  }).format(date);
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** "6:29 p. m.". */
export function formatTime(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat(LOCALE, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone,
  }).format(date);
}

/** The calendar day of `date` where the business is, as `YYYY-MM-DD`. */
function dayKeyOf(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(date);
}

/** "hoy" or "ayer" when `date` falls on that day of the business on `now`; null before. */
export function relativeDayOf(date: Date, now: Date, timeZone: string): 'hoy' | 'ayer' | null {
  const day = dayKeyOf(date, timeZone);
  if (day === dayKeyOf(now, timeZone)) return 'hoy';
  if (day === dayKeyOf(new Date(now.getTime() - MS_PER_DAY), timeZone)) return 'ayer';
  return null;
}
