import type { Placement } from '../../model/entry';

export interface ResolvedRange {
  readonly start: number;
  readonly end: number;
}

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

/**
 * Resolves a Placement (+ Fadeout) to its covered [start, end] epoch-ms interval, for
 * IndexedDB range filtering only. This intentionally duplicates a small slice of what
 * will become the entries feature's own `fadeout` pure module (`entries/SPEC.md`) —
 * kept minimal here rather than reaching into a feature that doesn't exist yet.
 */
export function resolvePlacementRange(placement: Placement): ResolvedRange {
  switch (placement.kind) {
    case 'point': {
      const at = Date.parse(placement.at);
      const before = (placement.fadeout?.beforeMinutes ?? 0) * MINUTE_MS;
      const after = (placement.fadeout?.afterMinutes ?? 0) * MINUTE_MS;
      return { start: at - before, end: at + after };
    }
    case 'period': {
      const start = Date.parse(placement.start);
      const end = Date.parse(placement.end);
      const before = (placement.fadeout?.beforeMinutes ?? 0) * MINUTE_MS;
      const after = (placement.fadeout?.afterMinutes ?? 0) * MINUTE_MS;
      return { start: start - before, end: end + after };
    }
    case 'dayBucketed': {
      const start = Date.parse(`${placement.day}T00:00:00.000Z`);
      return { start, end: start + DAY_MS };
    }
  }
}

export function rangesOverlap(a: ResolvedRange, queryStart: number, queryEnd: number): boolean {
  return a.start <= queryEnd && a.end >= queryStart;
}
