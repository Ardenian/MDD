import type { Placement, TimeSpan } from '../../data/model/placement';
import { resolveCoveredSpan } from '../../data/model/placement';
import type { BucketSize } from '../../data/model/settings';

/** An ordered run of Buckets over a range. Boundaries are local, never UTC. */
export interface BucketAxis {
  readonly size: BucketSize;
  /** `count + 1` instants: Bucket `i` runs from `boundaries[i]` to `boundaries[i + 1]`. */
  readonly boundaries: readonly number[];
  readonly count: number;
}

export interface BucketMembership {
  readonly index: number;
  /** How present the Entry was in this Bucket, in 0..1. */
  readonly weight: number;
}

const MINUTE_MS = 60_000;

/**
 * The Buckets covering a range, built by stepping real calendar units rather than fixed
 * durations — so a month is as long as that month is, and a daylight-saving day is 23 or
 * 25 hours, exactly as the user lived it.
 */
export function createBucketAxis(range: TimeSpan, size: BucketSize): BucketAxis {
  const boundaries = [startOfBucket(range.start, size)];
  while (boundaries[boundaries.length - 1] <= range.end) {
    boundaries.push(nextBoundary(boundaries[boundaries.length - 1], size));
  }
  return { size, boundaries, count: boundaries.length - 1 };
}

/** The Bucket an instant falls in, or `-1` when it lies outside the axis. */
export function bucketIndexOf(axis: BucketAxis, instant: number): number {
  if (instant < axis.boundaries[0] || instant >= axis.boundaries[axis.count]) {
    return -1;
  }
  let low = 0;
  let high = axis.count - 1;
  while (low < high) {
    const middle = (low + high + 1) >> 1;
    if (axis.boundaries[middle] <= instant) {
      low = middle;
    } else {
      high = middle - 1;
    }
  }
  return low;
}

/**
 * How much of an Entry each Bucket holds.
 *
 * A **Point** is an event: it spends exactly one unit of weight in total, spread across
 * Buckets by its Fadeout, so a Point with no Fadeout weighs 1 in one Bucket and widening
 * the Fadeout only redistributes that same unit. A **Period** and a **Day-bucketed**
 * Entry are coverage: each Bucket's weight is the share of that Bucket the Entry
 * occupies, so a Period filling half a Bucket weighs 0.5 there and a day fills every one
 * of its hours completely. Both readings agree on what a Fadeout does — membership falls
 * off linearly to 0 across its span.
 */
export function bucketWeights(axis: BucketAxis, placement: Placement): readonly BucketMembership[] {
  const segments = presenceSegments(placement);
  if (segments.length === 0) {
    // An instantaneous Point: all of its weight sits wherever it happened.
    const index = bucketIndexOf(axis, resolveCoveredSpan(placement).start);
    return index === -1 ? [] : [{ index, weight: 1 }];
  }

  const covered = resolveCoveredSpan(placement);
  const first = Math.max(bucketIndexOf(axis, covered.start), 0);
  const last =
    covered.end >= axis.boundaries[axis.count] ? axis.count - 1 : bucketIndexOf(axis, covered.end);
  if (last < 0 || first > last || covered.end < axis.boundaries[0]) {
    return [];
  }

  // A Point spreads one unit of weight over its whole Fadeout, wherever that lands — so
  // it is divided by its own total, not by how long a Bucket happens to be.
  const total = placement.kind === 'point' ? totalMass(segments) : 0;

  const memberships: BucketMembership[] = [];
  for (let index = first; index <= last; index++) {
    const start = axis.boundaries[index];
    const end = axis.boundaries[index + 1];
    const mass = massBetween(segments, start, end);
    const weight = total > 0 ? mass / total : mass / (end - start);
    if (weight > 0) {
      memberships.push({ index, weight });
    }
  }
  return memberships;
}

/** A piecewise-linear membership function: `value` runs from `from` to `to` over the span. */
interface PresenceSegment {
  readonly start: number;
  readonly end: number;
  readonly from: number;
  readonly to: number;
}

function presenceSegments(placement: Placement): readonly PresenceSegment[] {
  const core = coreSpan(placement);
  const before =
    (placement.kind === 'dayBucketed' ? 0 : (placement.fadeout?.beforeMinutes ?? 0)) * MINUTE_MS;
  const after =
    (placement.kind === 'dayBucketed' ? 0 : (placement.fadeout?.afterMinutes ?? 0)) * MINUTE_MS;

  const segments: PresenceSegment[] = [];
  if (before > 0) {
    segments.push({ start: core.start - before, end: core.start, from: 0, to: 1 });
  }
  if (core.end > core.start) {
    segments.push({ start: core.start, end: core.end, from: 1, to: 1 });
  }
  if (after > 0) {
    segments.push({ start: core.end, end: core.end + after, from: 1, to: 0 });
  }
  return segments;
}

/** The placement's own span, before any Fadeout widens it. */
function coreSpan(placement: Placement): TimeSpan {
  switch (placement.kind) {
    case 'point': {
      const at = Date.parse(placement.at);
      return { start: at, end: at };
    }
    case 'period':
      return { start: Date.parse(placement.start), end: Date.parse(placement.end) };
    case 'dayBucketed': {
      const covered = resolveCoveredSpan(placement);
      // The stored span ends on the day's last millisecond; as coverage it runs to
      // the next midnight.
      return { start: covered.start, end: covered.end + 1 };
    }
  }
}

function totalMass(segments: readonly PresenceSegment[]): number {
  return segments.reduce((sum, segment) => sum + area(segment, segment.start, segment.end), 0);
}

function massBetween(segments: readonly PresenceSegment[], start: number, end: number): number {
  return segments.reduce((sum, segment) => {
    const from = Math.max(segment.start, start);
    const to = Math.min(segment.end, end);
    return to <= from ? sum : sum + area(segment, from, to);
  }, 0);
}

/** The area under a linear segment between two instants inside it. */
function area(segment: PresenceSegment, from: number, to: number): number {
  const span = segment.end - segment.start;
  if (span <= 0) {
    return 0;
  }
  const valueAt = (instant: number) =>
    segment.from + ((segment.to - segment.from) * (instant - segment.start)) / span;
  return ((valueAt(from) + valueAt(to)) / 2) * (to - from);
}

function startOfBucket(instant: number, size: BucketSize): number {
  const date = new Date(instant);
  switch (size) {
    case 'hour':
      return new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        date.getHours(),
      ).getTime();
    case 'day':
      return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    case 'week': {
      // Weeks start on Monday (ISO 8601), as they do on the Calendar.
      const weekday = (date.getDay() + 6) % 7;
      return new Date(date.getFullYear(), date.getMonth(), date.getDate() - weekday).getTime();
    }
    case 'month':
      return new Date(date.getFullYear(), date.getMonth(), 1).getTime();
  }
}

function nextBoundary(boundary: number, size: BucketSize): number {
  const date = new Date(boundary);
  switch (size) {
    case 'hour':
      return new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        date.getHours() + 1,
      ).getTime();
    case 'day':
      return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime();
    case 'week':
      return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 7).getTime();
    case 'month':
      return new Date(date.getFullYear(), date.getMonth() + 1, 1).getTime();
  }
}
