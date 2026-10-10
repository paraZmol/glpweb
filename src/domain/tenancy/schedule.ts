import { WEEK_DAYS } from './constants';
import type { Schedule } from './types';

const MINUTES_PER_HOUR = 60;
const HOURS_PER_HALF_DAY = 12;
const DAYS_PER_WEEK = WEEK_DAYS.length;
const WEEKDAY_NAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const WEEKDAY_CODES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
/** Monday first, as a week is read in Peru. */
const READING_ORDER = [1, 2, 3, 4, 5, 6, 0];

function minutesOf(timeOfDay: string): number {
  const [hours = 0, minutes = 0] = timeOfDay.split(':').map(Number);
  return hours * MINUTES_PER_HOUR + minutes;
}

/** `20:00` → "8:00 p. m.", `07:30` → "7:30 a. m." (ui-system §4). */
export function formatTimeOfDay(timeOfDay: string): string {
  const [hours = 0, minutes = 0] = timeOfDay.split(':').map(Number);
  const period = hours < HOURS_PER_HALF_DAY ? 'a. m.' : 'p. m.';
  const shown = hours % HOURS_PER_HALF_DAY || HOURS_PER_HALF_DAY;
  return `${shown}:${String(minutes).padStart(2, '0')} ${period}`;
}

/** Day of the week (0 = Sunday) and minutes since midnight of `now` in a time zone. */
export function localClockOf(now: Date, timeZone: string): { day: number; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const valueOf = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return {
    day: Math.max(0, WEEKDAY_CODES.indexOf(valueOf('weekday'))),
    minutes: Number(valueOf('hour')) * MINUTES_PER_HOUR + Number(valueOf('minute')),
  };
}

export type OpenStatus =
  | { isOpen: true; closesAt: string }
  /** `daysUntil` 0 = later today, 1 = tomorrow; `opensOn` is that day of the week. */
  | { isOpen: false; opensAt: string; daysUntil: number; opensOn: number };

/**
 * Whether a distributor attends right now according to its schedule (the same window on every
 * listed day), and when that changes. The window does not cross midnight.
 */
export function openStatusAt(schedule: Schedule, now: Date, timeZone: string): OpenStatus {
  const { day, minutes } = localClockOf(now, timeZone);
  const opens = minutesOf(schedule.opensAt);
  const closes = minutesOf(schedule.closesAt);
  const attendsToday = schedule.days.includes(day);
  if (attendsToday && minutes >= opens && minutes < closes) {
    return { isOpen: true, closesAt: schedule.closesAt };
  }
  const firstOffset = attendsToday && minutes < opens ? 0 : 1;
  for (let offset = firstOffset; offset <= DAYS_PER_WEEK; offset += 1) {
    const opensOn = (day + offset) % DAYS_PER_WEEK;
    if (schedule.days.includes(opensOn)) {
      return { isOpen: false, opensAt: schedule.opensAt, daysUntil: offset, opensOn };
    }
  }
  return { isOpen: false, opensAt: schedule.opensAt, daysUntil: DAYS_PER_WEEK, opensOn: day };
}

/** "Abierto · cierra a las 8:00 p. m." / "Cerrado · abre mañana a las 7:00 a. m." */
export function describeOpenStatus(status: OpenStatus): string {
  if (status.isOpen) return `Abierto · cierra a las ${formatTimeOfDay(status.closesAt)}`;
  const at = `a las ${formatTimeOfDay(status.opensAt)}`;
  if (status.daysUntil === 0) return `Cerrado · abre ${at}`;
  if (status.daysUntil === 1) return `Cerrado · abre mañana ${at}`;
  return `Cerrado · abre el ${WEEKDAY_NAMES[status.opensOn]} ${at}`;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Where a run of consecutive days starts when read in a circle (…sábado, domingo, lunes…). */
function runStartOf(days: readonly number[]): number | null {
  const starts = READING_ORDER.filter(
    (day) => days.includes(day) && !days.includes((day + DAYS_PER_WEEK - 1) % DAYS_PER_WEEK),
  );
  return starts.length === 1 ? (starts[0] ?? null) : null;
}

/** "Todos los días", "Lunes a sábado" or "Lunes, miércoles y viernes". */
export function describeDays(days: readonly number[]): string {
  const ordered = READING_ORDER.filter((day) => days.includes(day));
  if (ordered.length === 0) return 'Sin días de atención';
  if (ordered.length === DAYS_PER_WEEK) return 'Todos los días';
  const start = runStartOf(ordered);
  if (start !== null && ordered.length > 2) {
    const end = (start + ordered.length - 1) % DAYS_PER_WEEK;
    return capitalize(`${WEEKDAY_NAMES[start]} a ${WEEKDAY_NAMES[end]}`);
  }
  const names = ordered.map((day) => WEEKDAY_NAMES[day] ?? '');
  if (names.length === 1) return capitalize(names[0] ?? '');
  return capitalize(`${names.slice(0, -1).join(', ')} y ${names.at(-1)}`);
}
