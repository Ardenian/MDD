import type { Placement } from '../../data/model/entry';

export interface CoveredInterval {
  readonly start: Date;
  readonly end: Date;
}

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

/**
 * Resolves a Placement (+ Fadeout) to the absolute interval it covers on the Calendar —
 * the canonical version of this computation (`entries/SPEC.md`). `data/`'s IndexedDB
 * adapter intentionally keeps its own minimal epoch-ms slice of this for range-query
 * filtering (`data/adapters/indexeddb/placement-range.util.ts`), since `data/` cannot
 * depend on `features/`.
 */
export function resolveCoveredInterval(placement: Placement): CoveredInterval {
  switch (placement.kind) {
    case 'point': {
      const at = new Date(placement.at).getTime();
      const before = (placement.fadeout?.beforeMinutes ?? 0) * MINUTE_MS;
      const after = (placement.fadeout?.afterMinutes ?? 0) * MINUTE_MS;
      return { start: new Date(at - before), end: new Date(at + after) };
    }
    case 'period': {
      const start = new Date(placement.start).getTime();
      const end = new Date(placement.end).getTime();
      const before = (placement.fadeout?.beforeMinutes ?? 0) * MINUTE_MS;
      const after = (placement.fadeout?.afterMinutes ?? 0) * MINUTE_MS;
      return { start: new Date(start - before), end: new Date(end + after) };
    }
    case 'dayBucketed': {
      const start = new Date(`${placement.day}T00:00:00.000Z`).getTime();
      return { start: new Date(start), end: new Date(start + DAY_MS) };
    }
  }
}
