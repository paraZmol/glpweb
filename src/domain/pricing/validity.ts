import { formatTimeOfDay } from '../tenancy/schedule';

// The dates of a promotion are instants (UTC); what a person reads and picks is the local time of
// the distributor ('America/Lima' by default; PLAN §11, 2026-10-16). Nothing here reads a clock:
// `now` always comes in.

const MS_PER_MINUTE = 60_000;
const MINUTES_PER_HOUR = 60;
const DAYS_PER_WEEK = 7;
const SUNDAY = 0;
const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];
const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/** A calendar day in the time zone of the distributor. */
interface LocalDay {
  year: number;
  /** 1 … 12 */
  month: number;
  day: number;
}

function partsOf(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(instant);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return {
    day: { year: value('year'), month: value('month'), day: value('day') },
    minutes: value('hour') * MINUTES_PER_HOUR + value('minute'),
  };
}

export function localDayOf(instant: Date, timeZone: string): LocalDay {
  return partsOf(instant, timeZone).day;
}

/** Minutes the zone is ahead of UTC at `instant` (Lima: −300). */
function offsetMinutes(instant: Date, timeZone: string): number {
  const { day, minutes } = partsOf(instant, timeZone);
  const asUtc = Date.UTC(day.year, day.month - 1, day.day) + minutes * MS_PER_MINUTE;
  const truncated = Math.floor(instant.getTime() / MS_PER_MINUTE) * MS_PER_MINUTE;
  return (asUtc - truncated) / MS_PER_MINUTE;
}

/** The instant a local day shows `timeOfDay` ('HH:MM') in `timeZone`. */
export function instantAt(day: LocalDay, timeOfDay: string, timeZone: string): Date {
  const [hours = 0, minutes = 0] = timeOfDay.split(':').map(Number);
  const guess = Date.UTC(day.year, day.month - 1, day.day, hours, minutes);
  const first = guess - offsetMinutes(new Date(guess), timeZone) * MS_PER_MINUTE;
  // A second pass settles the days a zone changes its offset.
  return new Date(guess - offsetMinutes(new Date(first), timeZone) * MS_PER_MINUTE);
}

/** The local day `days` after `day` (calendar arithmetic, no time zone involved). */
export function addDays(day: LocalDay, days: number): LocalDay {
  const moved = new Date(Date.UTC(day.year, day.month - 1, day.day + days));
  return { year: moved.getUTCFullYear(), month: moved.getUTCMonth() + 1, day: moved.getUTCDate() };
}

function weekdayOf(day: LocalDay): number {
  return new Date(Date.UTC(day.year, day.month - 1, day.day)).getUTCDay();
}

/** Quick choices of "¿Hasta cuándo?" (marketing §4, step 2). */
export type ValidityPreset =
  | { kind: 'today' }
  | { kind: 'weekend' }
  | { kind: 'days'; days: 7 | 15 | 30 }
  /** "Solo hoy, por horas": from and to, 'HH:MM' of today. */
  | { kind: 'todayHours'; from: string; to: string };

export interface ValidityWindow {
  startsAt: Date | 'now';
  endsAt: Date;
}

export interface LocalSettings {
  timeZone: string;
  /** Closing time of the distributor ('HH:MM'): the default end of a promotion. */
  closesAt: string;
}

/**
 * The window a quick choice means at `now`, ending at the closing time of the distributor (not
 * at midnight). "7 días" counts today: it ends at closing time of the seventh day, so it never
 * lasts more than 7 × 24 h. Null when the choice is already over today (after closing time, or
 * hours that have passed).
 */
export function promotionWindow(
  preset: ValidityPreset,
  now: Date,
  settings: LocalSettings,
): ValidityWindow | null {
  const today = localDayOf(now, settings.timeZone);
  const closingOn = (day: LocalDay) => instantAt(day, settings.closesAt, settings.timeZone);
  const window = (endsAt: Date, startsAt: Date | 'now' = 'now') =>
    endsAt.getTime() > now.getTime() ? { startsAt, endsAt } : null;
  switch (preset.kind) {
    case 'today':
      return window(closingOn(today));
    case 'weekend': {
      const sunday = addDays(today, (DAYS_PER_WEEK - weekdayOf(today) + SUNDAY) % DAYS_PER_WEEK);
      return window(closingOn(sunday)) ?? window(closingOn(addDays(sunday, DAYS_PER_WEEK)));
    }
    case 'days':
      return window(closingOn(addDays(today, preset.days - 1)));
    case 'todayHours': {
      const from = instantAt(today, preset.from, settings.timeZone);
      const startsAt = from.getTime() > now.getTime() ? from : 'now';
      return window(instantAt(today, preset.to, settings.timeZone), startsAt);
    }
  }
}

const sameDay = (a: LocalDay, b: LocalDay) =>
  a.year === b.year && a.month === b.month && a.day === b.day;

function timeOf(instant: Date, timeZone: string): string {
  const { minutes } = partsOf(instant, timeZone);
  const hours = String(Math.floor(minutes / MINUTES_PER_HOUR)).padStart(2, '0');
  return formatTimeOfDay(`${hours}:${String(minutes % MINUTES_PER_HOUR).padStart(2, '0')}`);
}

/** "domingo 18 de octubre" */
export function describeDay(instant: Date, timeZone: string): string {
  const day = localDayOf(instant, timeZone);
  return `${WEEKDAYS[weekdayOf(day)]} ${day.day} de ${MONTHS[day.month - 1]}`;
}

/**
 * The fixed line of validity next to every promoted price (marketing §3.1, H3): "Solo hoy de
 * 2:00 p. m. a 5:00 p. m.", "Solo hoy, hasta las 8:00 p. m." or "Hasta el domingo 18 de octubre,
 * 8:00 p. m.", in the time of the distributor. A promotion that has not started is not shown to
 * customers, so the start is only named when it is later today.
 */
export function describeValidity(
  window: { startsAt: Date; endsAt: Date },
  now: Date,
  timeZone: string,
): string {
  const today = localDayOf(now, timeZone);
  const ends = timeOf(window.endsAt, timeZone);
  if (!sameDay(localDayOf(window.endsAt, timeZone), today)) {
    return `Hasta el ${describeDay(window.endsAt, timeZone)}, ${ends}`;
  }
  if (window.startsAt.getTime() > now.getTime()) {
    return `Solo hoy de ${timeOf(window.startsAt, timeZone)} a ${ends}`;
  }
  return `Solo hoy, hasta las ${ends}`;
}
