import type { Placement } from '../../data/model/entry';

export type BucketSize = 'hour' | 'day' | 'week' | 'month';

export interface BucketBounds {
  readonly key: string;
  readonly start: number;
  readonly end: number;
}

export interface BucketWeight {
  readonly bucketKey: string;
  readonly weight: number;
}

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** The Bucket (UTC) containing a given instant, for the given Bucket size. */
export function bucketContaining(timestampMs: number, size: BucketSize): BucketBounds {
  const date = new Date(timestampMs);

  switch (size) {
    case 'hour': {
      const start = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), date.getUTCHours());
      return { key: new Date(start).toISOString(), start, end: start + HOUR_MS };
    }
    case 'day': {
      const start = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
      return { key: new Date(start).toISOString().slice(0, 10), start, end: start + DAY_MS };
    }
    case 'week': {
      const dayStart = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
      const isoDayOffset = (new Date(dayStart).getUTCDay() + 6) % 7; // days since Monday
      const start = dayStart - isoDayOffset * DAY_MS;
      return { key: new Date(start).toISOString().slice(0, 10), start, end: start + 7 * DAY_MS };
    }
    case 'month': {
      const start = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
      const end = Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1);
      const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
      return { key, start, end };
    }
  }
}

/**
 * A comparable integer position for a Bucket key, such that consecutive Buckets of the
 * given size always differ by exactly 1 — including week and month, whose real
 * calendar duration isn't constant, so a plain epoch-ms division wouldn't stay aligned
 * to calendar boundaries. This is what `lag-scan` shifts by.
 */
// 1970-01-01 (the Unix epoch) was a Thursday, so 1970-01-05 was the first Monday —
// used as an exact anchor for week indices so the math is integer division, never a
// rounded (and therefore phase-drift-prone) division of a raw epoch timestamp.
const WEEK_ANCHOR_MS = Date.UTC(1970, 0, 5);

export function bucketIndexForKey(key: string, size: BucketSize): number {
  switch (size) {
    case 'hour':
      return Math.round(Date.parse(key) / HOUR_MS);
    case 'day':
      return Math.round(Date.parse(`${key}T00:00:00.000Z`) / DAY_MS);
    case 'week':
      return Math.round((Date.parse(`${key}T00:00:00.000Z`) - WEEK_ANCHOR_MS) / (7 * DAY_MS));
    case 'month': {
      const [year, month] = key.split('-').map(Number);
      return year * 12 + (month - 1);
    }
  }
}

export function bucketKeyForIndex(index: number, size: BucketSize): string {
  switch (size) {
    case 'hour':
      return new Date(index * HOUR_MS).toISOString();
    case 'day':
      return new Date(index * DAY_MS).toISOString().slice(0, 10);
    case 'week':
      return new Date(WEEK_ANCHOR_MS + index * 7 * DAY_MS).toISOString().slice(0, 10);
    case 'month': {
      const year = Math.floor(index / 12);
      const month = ((index % 12) + 12) % 12;
      return `${year}-${String(month + 1).padStart(2, '0')}`;
    }
  }
}

interface WeightProfile {
  readonly coreStart: number;
  readonly coreEnd: number;
  readonly leadStart: number;
  readonly trailEnd: number;
}

function weightProfileFor(placement: Placement): WeightProfile {
  switch (placement.kind) {
    case 'point': {
      const at = Date.parse(placement.at);
      const before = (placement.fadeout?.beforeMinutes ?? 0) * MINUTE_MS;
      const after = (placement.fadeout?.afterMinutes ?? 0) * MINUTE_MS;
      return { coreStart: at, coreEnd: at, leadStart: at - before, trailEnd: at + after };
    }
    case 'period': {
      const start = Date.parse(placement.start);
      const end = Date.parse(placement.end);
      const before = (placement.fadeout?.beforeMinutes ?? 0) * MINUTE_MS;
      const after = (placement.fadeout?.afterMinutes ?? 0) * MINUTE_MS;
      return { coreStart: start, coreEnd: end, leadStart: start - before, trailEnd: end + after };
    }
    case 'dayBucketed': {
      const start = Date.parse(`${placement.day}T00:00:00.000Z`);
      const end = start + DAY_MS;
      return { coreStart: start, coreEnd: end, leadStart: start, trailEnd: end };
    }
  }
}

/**
 * Distributes one Entry's placement across Buckets of the given size, always summing
 * to exactly 1 across the Buckets returned. Interpretation of CONTEXT.md's "Fadeout
 * contributes weighted membership, weight falling off linearly to 0 across its span":
 * the whole covered span carries one unit of membership — full density where the
 * placement is certain (the core Point/Period), ramping linearly to zero across each
 * Fadeout wing — so an "occurrence" or "fraction" Signal aggregates sensibly regardless
 * of how much Fadeout uncertainty an Entry carries.
 *
 * A true instant (a Point with no Fadeout at all) has zero measure to integrate, so it
 * is handled as a special case: its one unit of weight goes entirely to the single
 * Bucket containing it.
 */
export function bucketWeightsFor(placement: Placement, size: BucketSize): readonly BucketWeight[] {
  const { coreStart, coreEnd, leadStart, trailEnd } = weightProfileFor(placement);
  const coreDuration = coreEnd - coreStart;
  const before = coreStart - leadStart;
  const after = trailEnd - coreEnd;

  if (coreDuration === 0 && before === 0 && after === 0) {
    return [{ bucketKey: bucketContaining(coreStart, size).key, weight: 1 }];
  }

  const peakWeight = 1 / (coreDuration + before / 2 + after / 2);
  const weights = new Map<string, number>();

  const accumulate = (segmentStart: number, segmentEnd: number, valueAt: (t: number) => number): void => {
    let cursor = segmentStart;
    while (cursor < segmentEnd) {
      const bucket = bucketContaining(cursor, size);
      const sliceEnd = Math.min(segmentEnd, bucket.end);
      const area = ((valueAt(cursor) + valueAt(sliceEnd)) / 2) * (sliceEnd - cursor);
      weights.set(bucket.key, (weights.get(bucket.key) ?? 0) + area);
      cursor = sliceEnd;
    }
  };

  if (before > 0) {
    accumulate(leadStart, coreStart, (t) => (peakWeight * (t - leadStart)) / before);
  }
  if (coreDuration > 0) {
    accumulate(coreStart, coreEnd, () => peakWeight);
  }
  if (after > 0) {
    accumulate(coreEnd, trailEnd, (t) => (peakWeight * (trailEnd - t)) / after);
  }

  return [...weights.entries()].map(([bucketKey, weight]) => ({ bucketKey, weight }));
}
