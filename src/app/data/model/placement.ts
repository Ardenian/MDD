/** An uncertainty margin extending a Point or Period placement. */
export interface Fadeout {
  readonly beforeMinutes: number;
  readonly afterMinutes: number;
}

export interface PointPlacement {
  readonly kind: 'point';
  readonly at: string;
  readonly fadeout?: Fadeout;
}

export interface PeriodPlacement {
  readonly kind: 'period';
  readonly start: string;
  readonly end: string;
  readonly fadeout?: Fadeout;
}

export interface DayBucketedPlacement {
  readonly kind: 'dayBucketed';
  /** Calendar day, `YYYY-MM-DD`; no time of day and no Fadeout. */
  readonly day: string;
}

export type Placement = PointPlacement | PeriodPlacement | DayBucketedPlacement;

/** A span between two instants, in epoch milliseconds. Boundary-inclusive. */
export interface TimeSpan {
  readonly start: number;
  readonly end: number;
}

/** A `TimeSpan` that is specifically a placement's Fadeout-resolved coverage. */
export type CoveredSpan = TimeSpan;

const MINUTE_MS = 60_000;

/**
 * The absolute span a placement covers once its Fadeout is applied — the single
 * definition of "covered span" for the whole app. The entries feature's `fadeout`
 * module and the IndexedDB range query both resolve through here rather than each
 * re-deriving the arithmetic.
 */
export function resolveCoveredSpan(placement: Placement): CoveredSpan {
  switch (placement.kind) {
    case 'point': {
      const at = Date.parse(placement.at);
      return {
        start: at - (placement.fadeout?.beforeMinutes ?? 0) * MINUTE_MS,
        end: at + (placement.fadeout?.afterMinutes ?? 0) * MINUTE_MS,
      };
    }
    case 'period': {
      const start = Date.parse(placement.start);
      const end = Date.parse(placement.end);
      return {
        start: start - (placement.fadeout?.beforeMinutes ?? 0) * MINUTE_MS,
        end: end + (placement.fadeout?.afterMinutes ?? 0) * MINUTE_MS,
      };
    }
    case 'dayBucketed': {
      // The user's own calendar day, not UTC's — and via the Date constructor rather than
      // a fixed 24h, so a daylight-saving day is 23 or 25 hours long, as it really is.
      // Spans are boundary-inclusive, so the day ends on its last millisecond rather
      // than at the next midnight, which would make it touch the following day too.
      const [year, month, day] = placement.day.split('-').map(Number);
      return {
        start: new Date(year ?? 0, (month ?? 1) - 1, day ?? 1).getTime(),
        end: new Date(year ?? 0, (month ?? 1) - 1, (day ?? 1) + 1).getTime() - 1,
      };
    }
  }
}

export function spansOverlap(a: TimeSpan, b: TimeSpan): boolean {
  return a.start <= b.end && b.start <= a.end;
}

/** The local calendar day an instant falls on, as `YYYY-MM-DD`. */
export function localDayOf(instant: number): string {
  const date = new Date(instant);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}
