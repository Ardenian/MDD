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

export interface Interval {
  readonly start: number;
  readonly end: number;
}

const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;

/**
 * The absolute span a placement covers once its Fadeout is applied — the single
 * definition of "covered interval" for the whole app. The entries feature's `fadeout`
 * module and the IndexedDB range query both resolve through here rather than each
 * re-deriving the arithmetic.
 */
export function resolveCoveredInterval(placement: Placement): Interval {
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
      const start = Date.parse(`${placement.day}T00:00:00.000Z`);
      return { start, end: start + DAY_MS };
    }
  }
}

export function intervalsOverlap(a: Interval, b: Interval): boolean {
  return a.start <= b.end && b.start <= a.end;
}
