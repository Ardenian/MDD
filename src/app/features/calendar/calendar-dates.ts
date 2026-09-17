import { localDayOf } from '../../data/model/placement';

export type CalendarView = 'day' | 'week';

/** Wall-clock slots per day; 30 minutes each, so a slot is also a keyboard step. */
export const SLOT_MINUTES = 30;
export const SLOTS_PER_DAY = (24 * 60) / SLOT_MINUTES;

export interface DayBounds {
  /** Local midnight. */
  readonly start: number;
  /** The next local midnight — exclusive, and 23 or 25 hours on, across a DST change. */
  readonly end: number;
}

export function isDayKey(value: string | null | undefined): value is string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '');
  if (match === null) {
    return false;
  }
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function parts(day: string): [number, number, number] {
  const [year, month, date] = day.split('-').map(Number);
  return [year ?? 1970, (month ?? 1) - 1, date ?? 1];
}

/** Calendar arithmetic through the Date constructor, never by adding 24h, so DST is right. */
export function addDays(day: string, amount: number): string {
  const [year, month, date] = parts(day);
  return localDayOf(new Date(year, month, date + amount).getTime());
}

export function dayBounds(day: string): DayBounds {
  const [year, month, date] = parts(day);
  return {
    start: new Date(year, month, date).getTime(),
    end: new Date(year, month, date + 1).getTime(),
  };
}

/** Weeks start on Monday (ISO 8601). */
export function startOfWeek(day: string): string {
  const [year, month, date] = parts(day);
  const weekday = new Date(year, month, date).getDay();
  return addDays(day, -((weekday + 6) % 7));
}

export function daysInView(view: CalendarView, day: string): readonly string[] {
  if (view === 'day') {
    return [day];
  }
  const monday = startOfWeek(day);
  return Array.from({ length: 7 }, (_, index) => addDays(monday, index));
}

export function shiftView(view: CalendarView, day: string, direction: -1 | 1): string {
  return addDays(day, direction * (view === 'day' ? 1 : 7));
}

/** The range to load: first day's local midnight to the last day's final millisecond. */
export function rangeOf(days: readonly string[]): { readonly start: string; readonly end: string } {
  const first = dayBounds(days[0] ?? localDayOf(0));
  const last = dayBounds(days[days.length - 1] ?? localDayOf(0));
  return { start: new Date(first.start).toISOString(), end: new Date(last.end - 1).toISOString() };
}

/** The instant a slot starts, in wall-clock time. */
export function slotStart(day: string, slot: number): number {
  const [year, month, date] = parts(day);
  return new Date(year, month, date, 0, slot * SLOT_MINUTES).getTime();
}

export function slotOf(instant: number): number {
  const date = new Date(instant);
  return Math.floor((date.getHours() * 60 + date.getMinutes()) / SLOT_MINUTES);
}
