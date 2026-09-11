import type { Uuid } from '../../data/model/common';
import type { Entry } from '../../data/model/entry';
import type { TrackerVersion } from '../../data/model/tracker';
import { bucketWeightsFor, type BucketSize } from './bucketing';

export interface SignalPoint {
  readonly bucketKey: string;
  readonly value: number;
}

export interface Signal {
  readonly name: string;
  readonly points: readonly SignalPoint[];
}

export interface SignalExtractionContext {
  /** Every in-scope Entry, top-level and children alike. */
  readonly entries: readonly Entry[];
  readonly versionsByKey: ReadonlyMap<string, TrackerVersion>;
  readonly bucketSize: BucketSize;
}

function versionKey(trackerId: Uuid, version: number): string {
  return `${trackerId}::${version}`;
}

export function buildExtractionContext(
  entries: readonly Entry[],
  trackerVersions: readonly TrackerVersion[],
  bucketSize: BucketSize,
): SignalExtractionContext {
  return {
    entries,
    versionsByKey: new Map(trackerVersions.map((v) => [versionKey(v.trackerId, v.version), v])),
    bucketSize,
  };
}

function fieldOf(ctx: SignalExtractionContext, entry: Entry, fieldName: string) {
  return ctx.versionsByKey
    .get(versionKey(entry.trackerId, entry.trackerVersion))
    ?.fields.find((field) => field.name === fieldName);
}

function snapshotValueOf(entry: Entry, fieldName: string): unknown {
  return entry.snapshot.find((field) => field.fieldName === fieldName)?.value;
}

// ---------------------------------------------------------------------------
// Core extraction, operating on an explicit entry list — shared by the top-level
// (filter by trackerId) and nested (filter by resolved path) entry points below.
// ---------------------------------------------------------------------------

function extractNumericFromEntries(
  ctx: SignalExtractionContext,
  entries: readonly Entry[],
  fieldName: string,
  signalName: string,
): Signal {
  const weightedSums = new Map<string, number>();
  const totalWeights = new Map<string, number>();

  for (const entry of entries) {
    const field = fieldOf(ctx, entry, fieldName);
    if (!field || (field.dataType !== 'integer' && field.dataType !== 'decimal')) {
      continue;
    }
    const value = snapshotValueOf(entry, fieldName);
    if (typeof value !== 'number') {
      continue;
    }

    for (const { bucketKey, weight } of bucketWeightsFor(entry.placement, ctx.bucketSize)) {
      weightedSums.set(bucketKey, (weightedSums.get(bucketKey) ?? 0) + weight * value);
      totalWeights.set(bucketKey, (totalWeights.get(bucketKey) ?? 0) + weight);
    }
  }

  const points = [...totalWeights.entries()].map(([bucketKey, totalWeight]) => ({
    bucketKey,
    value: totalWeight === 0 ? 0 : (weightedSums.get(bucketKey) ?? 0) / totalWeight,
  }));

  return { name: signalName, points };
}

function extractOccurrenceFromEntries(entries: readonly Entry[], bucketSize: BucketSize, signalName: string): Signal {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    for (const { bucketKey, weight } of bucketWeightsFor(entry.placement, bucketSize)) {
      counts.set(bucketKey, (counts.get(bucketKey) ?? 0) + weight);
    }
  }
  return { name: signalName, points: [...counts.entries()].map(([bucketKey, value]) => ({ bucketKey, value })) };
}

function extractFractionFromEntries(
  entries: readonly Entry[],
  bucketSize: BucketSize,
  signalName: string,
  matches: (entry: Entry) => boolean,
): Signal {
  const numerators = new Map<string, number>();
  const denominators = new Map<string, number>();

  for (const entry of entries) {
    const isMatch = matches(entry);
    for (const { bucketKey, weight } of bucketWeightsFor(entry.placement, bucketSize)) {
      denominators.set(bucketKey, (denominators.get(bucketKey) ?? 0) + weight);
      if (isMatch) {
        numerators.set(bucketKey, (numerators.get(bucketKey) ?? 0) + weight);
      }
    }
  }

  const points = [...denominators.entries()].map(([bucketKey, denominator]) => ({
    bucketKey,
    // A Bucket with Entries but none matching reports 0, never undefined/NaN.
    value: denominator === 0 ? 0 : (numerators.get(bucketKey) ?? 0) / denominator,
  }));

  return { name: signalName, points };
}

function selectFieldMatches(ctx: SignalExtractionContext, entry: Entry, fieldName: string, option: string): boolean {
  const field = fieldOf(ctx, entry, fieldName);
  if (!field || (field.dataType !== 'singleSelect' && field.dataType !== 'multiSelect')) {
    return false;
  }
  const value = snapshotValueOf(entry, fieldName);
  return field.dataType === 'singleSelect' ? value === option : Array.isArray(value) && value.includes(option);
}

// ---------------------------------------------------------------------------
// Top-level Signals: every Entry of a given Tracker (its own occurrences, wherever in
// the reference graph they also happen to sit as someone else's child).
// ---------------------------------------------------------------------------

export function extractNumericFieldSignal(
  ctx: SignalExtractionContext,
  trackerId: Uuid,
  fieldName: string,
  signalName: string,
): Signal {
  return extractNumericFromEntries(ctx, entriesOfTracker(ctx, trackerId), fieldName, signalName);
}

export function extractOccurrenceSignal(ctx: SignalExtractionContext, trackerId: Uuid, signalName: string): Signal {
  return extractOccurrenceFromEntries(entriesOfTracker(ctx, trackerId), ctx.bucketSize, signalName);
}

export function extractSelectStateSignal(
  ctx: SignalExtractionContext,
  trackerId: Uuid,
  fieldName: string,
  option: string,
  signalName: string,
): Signal {
  return extractFractionFromEntries(entriesOfTracker(ctx, trackerId), ctx.bucketSize, signalName, (entry) =>
    selectFieldMatches(ctx, entry, fieldName, option),
  );
}

export function extractBooleanFieldSignal(
  ctx: SignalExtractionContext,
  trackerId: Uuid,
  fieldName: string,
  signalName: string,
): Signal {
  return extractFractionFromEntries(entriesOfTracker(ctx, trackerId), ctx.bucketSize, signalName, (entry) => {
    const field = fieldOf(ctx, entry, fieldName);
    return field?.dataType === 'boolean' && snapshotValueOf(entry, fieldName) === true;
  });
}

export function extractTagPresenceSignal(
  ctx: SignalExtractionContext,
  trackerId: Uuid,
  tag: string,
  signalName: string,
): Signal {
  return extractFractionFromEntries(entriesOfTracker(ctx, trackerId), ctx.bucketSize, signalName, (entry) =>
    entry.tags.includes(tag),
  );
}

function entriesOfTracker(ctx: SignalExtractionContext, trackerId: Uuid): readonly Entry[] {
  return ctx.entries.filter((entry) => entry.trackerId === trackerId);
}

// ---------------------------------------------------------------------------
// Nested child-Field Signals, to arbitrary depth. A Child Entry's placement always
// mirrors its parent's (CONTEXT.md), so once resolved to the leaf Entry set, this is
// exactly the same weighted extraction as a top-level Signal — no separate bucketing.
// ---------------------------------------------------------------------------

/** Walks a chain of reference Field names from every root-Tracker Entry down to the
 *  leaf Entries at the end of the path. */
export function resolveNestedEntries(
  ctx: SignalExtractionContext,
  rootTrackerId: Uuid,
  path: readonly string[],
): readonly Entry[] {
  const entriesById = new Map(ctx.entries.map((entry) => [entry.id, entry]));
  let frontier: readonly Entry[] = entriesOfTracker(ctx, rootTrackerId);

  for (const fieldName of path) {
    const next: Entry[] = [];
    for (const entry of frontier) {
      const value = snapshotValueOf(entry, fieldName);
      const childIds = Array.isArray(value) ? value : value == null ? [] : [value];
      for (const childId of childIds) {
        const child = entriesById.get(String(childId));
        if (child) {
          next.push(child);
        }
      }
    }
    frontier = next;
  }

  return frontier;
}

export function extractNestedNumericSignal(
  ctx: SignalExtractionContext,
  rootTrackerId: Uuid,
  path: readonly string[],
  leafFieldName: string,
  signalName: string,
): Signal {
  return extractNumericFromEntries(ctx, resolveNestedEntries(ctx, rootTrackerId, path), leafFieldName, signalName);
}

export function extractNestedFractionSignal(
  ctx: SignalExtractionContext,
  rootTrackerId: Uuid,
  path: readonly string[],
  signalName: string,
  matches: (entry: Entry) => boolean,
): Signal {
  return extractFractionFromEntries(resolveNestedEntries(ctx, rootTrackerId, path), ctx.bucketSize, signalName, matches);
}
