import type { Uuid } from '../../data/model/common';
import type { Entry } from '../../data/model/entry';
import type { FieldDef, TrackerVersion } from '../../data/model/tracker';
import { type BucketSize } from './bucketing';
import { pointBiserialCorrelation, spearmanCorrelation } from './correlation-stats';
import type { LagRange } from './lag-scan';
import { scanLags } from './lag-scan';
import { benjaminiHochberg } from './significance';
import {
  buildExtractionContext,
  extractBooleanFieldSignal,
  extractNumericFieldSignal,
  extractOccurrenceSignal,
  extractSelectStateSignal,
  extractTagPresenceSignal,
  type Signal,
  type SignalExtractionContext,
} from './signal-extraction';

/**
 * A Signal is always a continuous per-Bucket series in this implementation — a numeric
 * Field's mean, a weighted occurrence count, or a weighted fraction (select/boolean
 * state, Tag presence). There is therefore no genuinely categorical, multi-valued
 * per-Bucket variable for Cramér's V's contingency-table math to apply to: two
 * `'fraction'` Signals (e.g. Energy=low vs Symptoms=bloating) are still two continuous
 * [0,1] series, not a joint category count. `correlation/SPEC.md`'s Method table names
 * Cramér's V for "categorical × categorical" — this is a disclosed simplification, not
 * an oversight: v1's Discovery scan uses Spearman for numeric×numeric and
 * point-biserial (== Pearson) for anything involving a fraction Signal, and
 * `correlation-stats.ts`'s `cramersV` is kept available (tested, correct) for if/when a
 * genuinely categorical per-Bucket representation is added later.
 */
export type SignalKind = 'numeric' | 'fraction';

export interface TaggedSignal extends Signal {
  readonly kind: SignalKind;
}

export interface DiscoveryScope {
  readonly trackerIds: readonly Uuid[] | 'all';
}

/**
 * Builds every top-level (non-nested — see the module doc for scope) Signal for the
 * in-scope Trackers: one Occurrence Signal per Tracker, one numeric Signal per numeric
 * Field actually used by its Entries (across whichever Tracker Versions they're
 * pinned to), one fraction Signal per select option / boolean Field, and one Tag
 * presence Signal per Tag actually used, per in-scope Tracker.
 */
export function generateSignals(
  entries: readonly Entry[],
  trackerVersions: readonly TrackerVersion[],
  scope: DiscoveryScope,
  bucketSize: BucketSize,
): readonly TaggedSignal[] {
  const ctx = buildExtractionContext(entries, trackerVersions, bucketSize);
  const trackerIds =
    scope.trackerIds === 'all' ? [...new Set(entries.map((entry) => entry.trackerId))] : scope.trackerIds;

  const signals: TaggedSignal[] = [];

  for (const trackerId of trackerIds) {
    signals.push({ ...extractOccurrenceSignal(ctx, trackerId, `${trackerId}.occurrence`), kind: 'numeric' });

    for (const field of fieldsUsedBy(ctx, entries, trackerId)) {
      signals.push(...signalsForField(ctx, trackerId, field));
    }

    for (const tag of tagsUsedBy(entries, trackerId)) {
      signals.push({
        ...extractTagPresenceSignal(ctx, trackerId, tag, `${trackerId}#${tag}`),
        kind: 'fraction',
      });
    }
  }

  return signals.filter((signal) => signal.points.length > 0);
}

function signalsForField(ctx: SignalExtractionContext, trackerId: Uuid, field: FieldDef): readonly TaggedSignal[] {
  switch (field.dataType) {
    case 'integer':
    case 'decimal':
      return [
        { ...extractNumericFieldSignal(ctx, trackerId, field.name, `${trackerId}.${field.name}`), kind: 'numeric' },
      ];
    case 'boolean':
      return [
        { ...extractBooleanFieldSignal(ctx, trackerId, field.name, `${trackerId}.${field.name}`), kind: 'fraction' },
      ];
    case 'singleSelect':
    case 'multiSelect':
      return field.options.map((option) => ({
        ...extractSelectStateSignal(ctx, trackerId, field.name, option, `${trackerId}.${field.name}=${option}`),
        kind: 'fraction' as const,
      }));
    case 'text':
    case 'longText':
    case 'reference':
      return [];
  }
}

function fieldsUsedBy(ctx: SignalExtractionContext, entries: readonly Entry[], trackerId: Uuid): readonly FieldDef[] {
  const fields = new Map<string, FieldDef>();
  for (const entry of entries) {
    if (entry.trackerId !== trackerId) {
      continue;
    }
    const version = ctx.versionsByKey.get(`${entry.trackerId}::${entry.trackerVersion}`);
    for (const field of version?.fields ?? []) {
      fields.set(`${field.name}::${field.dataType}`, field);
    }
  }
  return [...fields.values()];
}

function tagsUsedBy(entries: readonly Entry[], trackerId: Uuid): readonly string[] {
  return [...new Set(entries.filter((entry) => entry.trackerId === trackerId).flatMap((entry) => entry.tags))];
}

// ---------------------------------------------------------------------------
// Pairwise scan, guardrails, and ranking.
// ---------------------------------------------------------------------------

export interface DiscoveryGuardrails {
  readonly minSampleSize: number;
  readonly pValueThreshold: number;
  readonly benjaminiHochberg: boolean;
}

export interface DiscoveryOptions {
  readonly bucketSize: BucketSize;
  readonly lagRange: LagRange;
  readonly guardrails: DiscoveryGuardrails;
  /** Checked between pairs; when true, the scan stops without throwing. */
  readonly isCancelled?: () => boolean;
}

export interface DiscoveryCandidate {
  readonly signalA: string;
  readonly signalB: string;
  readonly lag: number;
  readonly effectSize: number;
  readonly n: number;
  readonly pValue: number;
  /** Equals `pValue` when Benjamini–Hochberg correction is off. */
  readonly adjustedPValue: number;
  readonly significant: boolean;
}

/**
 * Runs every pair of `signals` through `lag-scan`, keeps pairs whose best Lag meets
 * `minSampleSize`, applies the significance guardrail (with or without
 * Benjamini–Hochberg correction across the whole scanned set), and returns every
 * surviving pair ranked by |effect size| descending — regardless of `significant`, so
 * the caller (the Correlation page) decides whether to hide non-significant rows.
 */
export function runDiscovery(
  signals: readonly TaggedSignal[],
  options: DiscoveryOptions,
): readonly DiscoveryCandidate[] {
  interface RawResult {
    readonly signalA: string;
    readonly signalB: string;
    readonly lag: number;
    readonly effectSize: number;
    readonly n: number;
    readonly pValue: number;
  }

  const raw: RawResult[] = [];

  outer: for (let i = 0; i < signals.length; i++) {
    for (let j = i + 1; j < signals.length; j++) {
      if (options.isCancelled?.()) {
        break outer;
      }

      const a = signals[i];
      const b = signals[j];
      const method = a.kind === 'numeric' && b.kind === 'numeric' ? spearmanCorrelation : pointBiserialCorrelation;
      const scan = scanLags(a, b, options.bucketSize, options.lagRange, method);

      if (scan.bestResult && scan.bestResult.n >= options.guardrails.minSampleSize) {
        raw.push({
          signalA: a.name,
          signalB: b.name,
          lag: scan.bestLag,
          effectSize: scan.bestResult.effectSize,
          n: scan.bestResult.n,
          pValue: scan.bestResult.pValue,
        });
      }
    }
  }

  const adjustedPValues = options.guardrails.benjaminiHochberg
    ? benjaminiHochberg(
        raw.map((r) => r.pValue),
        options.guardrails.pValueThreshold,
      )
    : raw.map((r, index) => ({ index, pValue: r.pValue, adjustedPValue: r.pValue, significant: r.pValue <= options.guardrails.pValueThreshold }));

  const candidates: DiscoveryCandidate[] = raw.map((r, index) => ({
    ...r,
    adjustedPValue: adjustedPValues[index].adjustedPValue,
    significant: adjustedPValues[index].significant,
  }));

  return candidates.sort((a, b) => Math.abs(b.effectSize) - Math.abs(a.effectSize));
}
