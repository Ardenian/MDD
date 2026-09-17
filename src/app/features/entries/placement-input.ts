/**
 * `<input type="datetime-local">` speaks local wall-clock time with no zone
 * (`2026-03-01T10:01`); placements store absolute ISO instants. These convert between the
 * two in the user's own timezone.
 */
export function toLocalDateTimeInput(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Returns `null` for anything the input could not have produced. */
export function fromLocalDateTimeInput(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (match === null) {
    return null;
  }
  const [year, month, day, hours, minutes] = match.slice(1).map(Number) as [
    number,
    number,
    number,
    number,
    number,
  ];
  return new Date(year, month - 1, day, hours, minutes).toISOString();
}

/** Fadeout minutes from a number input: empty is 0, anything else must be a whole number. */
export function minutesFromInput(value: string): number {
  if (value.trim() === '') {
    return 0;
  }
  const minutes = Number(value);
  return Number.isInteger(minutes) ? minutes : Number.NaN;
}
