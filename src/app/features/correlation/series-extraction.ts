import type { Entry } from '../../data/model/entry';
import type { FieldDeclaration } from '../../data/model/field-declaration';
import type { FieldDef } from '../../data/model/field-def';
import type { FieldValue } from '../../data/model/field-values';
import type { Tracker } from '../../data/model/tracker';
import { trackerVersionKey } from '../../data/model/tracker-version';
import type { CorrelationDataset } from '../../data/ports/correlation-data-source';
import { type BucketAxis, bucketWeights } from './bucketing';
import type { SeriesValue } from './correlation-stats';

export type SeriesKind = 'numeric' | 'occurrence' | 'fraction' | 'sum' | 'tag';

/**
 * The name carried by the synthetic Series read from a Period Entry's own placement.
 * Deliberately not a natural-language word: it is what the page matches on to swap in a
 * translated label, and no Field a user names by hand is likely to collide with it.
 */
export const ENTRY_DURATION = 'entryDuration';

const MINUTE_MS = 60_000;

export interface Series {
  /** Stable and deterministic, so a scan of the same data always names things alike. */
  readonly id: string;
  /**
   * The Tracker path that leads to the Series, built from the user's own names — e.g.
   * `Meal → Ingredients: Ingredient`. Empty for a Tag, which belongs to no one Tracker.
   */
  readonly path: string;
  /**
   * What is measured, again in the user's words: a Field name, `Field = option`, or a
   * Tag. Empty for an occurrence count, which measures the path itself. No app wording
   * is baked in here — the page composes the display label from translations.
   */
  readonly name: string;
  readonly kind: SeriesKind;
  /**
   * What the Series was derived from — a path and Field, a path's occurrences, or a Tag.
   * Two Series sharing a source are arithmetically tied rather than related: the options
   * of one select Field always move against each other, whatever the diary says.
   */
  readonly source: string;
  /** The Tracker the Series reads from — the child's own Tracker for a nested Field. */
  readonly trackerId: string;
  /** One value per Bucket of the axis; `null` where that Bucket has nothing to say. */
  readonly values: readonly SeriesValue[];
}

/**
 * Turns Entries into Series aligned to an axis of Buckets.
 *
 * Every Entry is read against the Tracker Version it pinned to, never the Tracker's
 * current schema (ADR 0005) — a Field renamed last week must not silently absorb
 * last year's values. Child Entries are reached through their parents, so a nested
 * Field's Series is named by the path that leads to it.
 */
export function extractSeries(dataset: CorrelationDataset, axis: BucketAxis): readonly Series[] {
  const versions = new Map(
    dataset.trackerVersions.map((version) => [
      trackerVersionKey(version.trackerId, version.version),
      version,
    ]),
  );
  const trackers = new Map(dataset.trackers.map((tracker) => [tracker.id, tracker]));
  const entries = new Map(dataset.entries.map((entry) => [entry.id, entry]));
  const builder = new SeriesBuilder(axis.count);

  for (const entry of dataset.entries) {
    const version = versions.get(trackerVersionKey(entry.trackerId, entry.trackerVersion));
    if (version === undefined) {
      // Without its pinned Version there is no schema to read the snapshot against.
      continue;
    }
    const memberships = bucketWeights(axis, entry.placement);
    if (memberships.length === 0) {
      continue;
    }
    const path = pathOf(entry, entries, trackers);

    for (const { index, weight } of memberships) {
      builder.add({
        id: `${path.id}|occurrence`,
        source: `${path.id}|occurrence`,
        path: path.label,
        name: '',
        kind: 'occurrence',
        trackerId: entry.trackerId,
        index,
        numerator: weight,
        denominator: weight,
      });

      contributeDuration(builder, path, entry, index, weight);

      const declarations = trackers.get(entry.trackerId)?.fieldDeclarations;
      for (const field of version.fields) {
        contributeField(builder, path, entry, field, index, weight, declarations?.[field.name]);
      }
      for (const tag of entry.tags) {
        builder.add({
          id: `tag|${tag}`,
          source: `tag|${tag}`,
          path: '',
          name: tag,
          kind: 'tag',
          trackerId: entry.trackerId,
          index,
          numerator: weight,
          denominator: weight,
        });
      }
      // Every Entry counts towards a Tag's denominator, not only the ones carrying it.
      builder.addDenominator('tag', index, weight);
    }
  }

  return builder.build();
}

interface SeriesPath {
  readonly id: string;
  readonly label: string;
}

/** The chain of Trackers and reference Fields that leads to an Entry. */
function pathOf(
  entry: Entry,
  entries: ReadonlyMap<string, Entry>,
  trackers: ReadonlyMap<string, Tracker>,
): SeriesPath {
  const name = trackers.get(entry.trackerId)?.name ?? entry.trackerId;
  const parent = entry.parentEntryId === null ? undefined : entries.get(entry.parentEntryId);
  if (parent === undefined) {
    return { id: entry.trackerId, label: name };
  }

  const parentPath = pathOf(parent, entries, trackers);
  const field = referenceFieldHolding(parent, entry.id);
  return {
    id: `${parentPath.id}>${field ?? '?'}>${entry.trackerId}`,
    label: `${parentPath.label} → ${field ?? '?'}: ${name}`,
  };
}

/** A reference Field stores its children's ids, which is what names the link. */
function referenceFieldHolding(parent: Entry, childId: string): string | null {
  for (const { fieldName, value } of parent.snapshot) {
    if (Array.isArray(value) && value.includes(childId)) {
      return fieldName;
    }
    if (value === childId) {
      return fieldName;
    }
  }
  return null;
}

/**
 * A Period's own length, as a Series nobody has to log. Points have no span at all, and
 * a Day-bucketed Entry's span is always exactly one day — a Series that never varies
 * cannot correlate with anything, so neither contributes.
 */
function contributeDuration(
  builder: SeriesBuilder,
  path: SeriesPath,
  entry: Entry,
  index: number,
  weight: number,
): void {
  if (entry.placement.kind !== 'period') {
    return;
  }
  const minutes = (Date.parse(entry.placement.end) - Date.parse(entry.placement.start)) / MINUTE_MS;
  if (!Number.isFinite(minutes)) {
    return;
  }
  builder.add({
    id: `${path.id}|${ENTRY_DURATION}`,
    source: `${path.id}|${ENTRY_DURATION}`,
    path: path.label,
    name: ENTRY_DURATION,
    kind: 'numeric',
    trackerId: entry.trackerId,
    index,
    numerator: weight * minutes,
    denominator: weight,
  });
}

function contributeField(
  builder: SeriesBuilder,
  path: SeriesPath,
  entry: Entry,
  field: FieldDef,
  index: number,
  weight: number,
  declaration: FieldDeclaration | undefined,
): void {
  const raw = entry.snapshot.find((value) => value.fieldName === field.name)?.value;

  switch (field.dataType) {
    case 'integer':
    case 'decimal': {
      if (typeof raw === 'number' && Number.isFinite(raw)) {
        // A weighted mean: an Entry half-present in a Bucket carries half a say in it.
        builder.add({
          id: `${path.id}|field|${field.name}`,
          source: `${path.id}|${field.name}`,
          path: path.label,
          name: field.name,
          kind: 'numeric',
          trackerId: entry.trackerId,
          index,
          numerator: weight * raw,
          denominator: weight,
          baseline: declaration?.baseline,
        });
        if (declaration?.sum === true) {
          // The same numerator, read back without dividing by it (declared per Field, so
          // a Field nobody asked to total costs no one a comparison — see the guide, §7).
          builder.add({
            id: `${path.id}|field|${field.name}|sum`,
            source: `${path.id}|${field.name}`,
            path: path.label,
            name: field.name,
            kind: 'sum',
            trackerId: entry.trackerId,
            index,
            numerator: weight * raw,
            denominator: weight,
            // The same baseline as the mean: a Field declared both must not read over
            // fewer Buckets as a total than it does as an average.
            baseline: declaration.baseline,
          });
        }
      }
      return;
    }
    case 'boolean': {
      if (typeof raw === 'boolean') {
        builder.add({
          id: `${path.id}|bool|${field.name}`,
          source: `${path.id}|${field.name}`,
          path: path.label,
          name: field.name,
          kind: 'fraction',
          trackerId: entry.trackerId,
          index,
          numerator: raw ? weight : 0,
          denominator: weight,
          baseline: declaration?.baseline,
        });
      }
      return;
    }
    case 'singleSelect': {
      for (const option of field.options) {
        // Every option gets its own Series, so each is a plain 0..1 fraction rather than
        // a category code that only looks numeric.
        builder.add({
          id: `${path.id}|select|${field.name}|${option}`,
          source: `${path.id}|${field.name}`,
          path: path.label,
          name: `${field.name} = ${option}`,
          kind: 'fraction',
          trackerId: entry.trackerId,
          index,
          numerator: raw === option ? weight : 0,
          denominator: weight,
        });
      }
      return;
    }
    case 'multiSelect': {
      const chosen = Array.isArray(raw) ? raw : [];
      for (const option of field.options) {
        builder.add({
          id: `${path.id}|multi|${field.name}|${option}`,
          source: `${path.id}|${field.name}`,
          path: path.label,
          name: `${field.name} = ${option}`,
          kind: 'fraction',
          trackerId: entry.trackerId,
          index,
          numerator: chosen.includes(option) ? weight : 0,
          denominator: weight,
        });
      }
      return;
    }
    case 'text':
    case 'longText':
    case 'reference':
      // Free text has no ordering to correlate, and a reference Field's own Series are
      // the child Entries it points at.
      return;
  }
}

/**
 * A declared baseline as the Series reads it: a boolean is a 0..1 fraction like any
 * other tick, a number is itself. Select options are not filled in this pass — one
 * declared option has to zero-fill every sibling option's Series too, which the
 * per-option accumulators can't see from here.
 */
function baselineValueOf(accumulator: Accumulator): number | null {
  const { baseline, kind } = accumulator;
  if (baseline === undefined || baseline === null) {
    return null;
  }
  if (kind === 'fraction' && typeof baseline === 'boolean') {
    return baseline ? 1 : 0;
  }
  if (
    (kind === 'numeric' || kind === 'sum') &&
    typeof baseline === 'number' &&
    Number.isFinite(baseline)
  ) {
    return baseline;
  }
  return null;
}

interface Accumulator {
  readonly path: string;
  readonly name: string;
  readonly kind: SeriesKind;
  readonly source: string;
  readonly trackerId: string;
  readonly numerator: Float64Array;
  readonly denominator: Float64Array;
  /** What an unlogged Bucket means here, if the Field was declared one. */
  readonly baseline: FieldValue | undefined;
  /** The first and last Bucket this Series has any data in; -1 until it has some. */
  firstIndex: number;
  lastIndex: number;
}

/** One Entry's contribution to one Bucket of one Series. */
interface Contribution {
  readonly id: string;
  readonly source: string;
  readonly path: string;
  readonly name: string;
  readonly kind: SeriesKind;
  readonly trackerId: string;
  readonly index: number;
  readonly numerator: number;
  readonly denominator: number;
  readonly baseline?: FieldValue;
}

class SeriesBuilder {
  private readonly accumulators = new Map<string, Accumulator>();
  /** Tag Series share one denominator: every Entry in the Bucket, tagged or not. */
  private readonly sharedDenominators = new Map<string, Float64Array>();

  private readonly bucketCount: number;

  constructor(bucketCount: number) {
    this.bucketCount = bucketCount;
  }

  add(contribution: Contribution): void {
    const { id, source, path, name, kind, trackerId, index, numerator, denominator } = contribution;
    let accumulator = this.accumulators.get(id);
    if (accumulator === undefined) {
      accumulator = {
        path,
        name,
        kind,
        source,
        trackerId,
        numerator: new Float64Array(this.bucketCount),
        denominator: new Float64Array(this.bucketCount),
        // Declared per Field, so every contribution to this Series carries the same one.
        baseline: contribution.baseline,
        firstIndex: -1,
        lastIndex: -1,
      };
      this.accumulators.set(id, accumulator);
    }
    accumulator.numerator[index] += numerator;
    accumulator.denominator[index] += denominator;
    accumulator.firstIndex =
      accumulator.firstIndex === -1 ? index : Math.min(accumulator.firstIndex, index);
    accumulator.lastIndex = Math.max(accumulator.lastIndex, index);
  }

  addDenominator(shared: string, index: number, weight: number): void {
    let totals = this.sharedDenominators.get(shared);
    if (totals === undefined) {
      totals = new Float64Array(this.bucketCount);
      this.sharedDenominators.set(shared, totals);
    }
    totals[index] += weight;
  }

  build(): readonly Series[] {
    const series: Series[] = [];
    for (const [id, accumulator] of this.accumulators) {
      const values = this.valuesOf(accumulator);
      // A Series that never has anything to say cannot correlate with anything.
      if (values.some((value) => value !== null)) {
        series.push({
          id,
          path: accumulator.path,
          name: accumulator.name,
          kind: accumulator.kind,
          source: accumulator.source,
          trackerId: accumulator.trackerId,
          values,
        });
      }
    }
    return series.sort((left, right) => left.id.localeCompare(right.id));
  }

  private valuesOf(accumulator: Accumulator): readonly SeriesValue[] {
    const tagTotals = this.sharedDenominators.get('tag');
    const values: SeriesValue[] = [];

    for (let index = 0; index < this.bucketCount; index++) {
      if (accumulator.kind === 'occurrence') {
        // Nothing happening is a fact about the Bucket — but only once the Tracker was
        // being kept at all. Counting the months before its first Entry as real zeros
        // would make any two Trackers started the same week look perfectly correlated,
        // on the strength of the emptiness they share rather than anything logged.
        const kept = index >= accumulator.firstIndex && index <= accumulator.lastIndex;
        values.push(kept ? accumulator.numerator[index] : null);
        continue;
      }
      const denominator =
        accumulator.kind === 'tag' ? (tagTotals?.[index] ?? 0) : accumulator.denominator[index];
      if (denominator > 0) {
        // A total is the same weighted numerator as the mean, simply not divided by it.
        values.push(
          accumulator.kind === 'sum'
            ? accumulator.numerator[index]
            : accumulator.numerator[index] / denominator,
        );
        continue;
      }
      // A Bucket with no Entries to read says nothing — unless the Field was declared a
      // baseline, which is the user stating what not logging it means. Bounded to the
      // window the Tracker was actually kept in, for the same reason `occurrence` is.
      const kept = index >= accumulator.firstIndex && index <= accumulator.lastIndex;
      values.push(kept ? baselineValueOf(accumulator) : null);
    }
    return values;
  }
}
