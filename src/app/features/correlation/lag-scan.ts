import type { LagRange } from '../../data/model/settings';
import {
  correlate,
  type CorrelationMethod,
  type CorrelationResult,
  type SeriesValue,
} from './correlation-stats';

export interface LagResult {
  /** In Buckets. Positive means the second Series follows the first. */
  readonly lag: number;
  readonly result: CorrelationResult;
}

export interface LagScan {
  /** The strongest relationship found, by absolute effect size. */
  readonly best: LagResult;
  /** Always reported beside the best, so a chosen lag can be read against no lag at all. */
  readonly atZero: LagResult | null;
  readonly tested: readonly LagResult[];
}

export interface LagScanOptions {
  /**
   * Lags leaving fewer overlapping Buckets than this are not scanned at all. Shifting a
   * Series far enough always leaves a handful of Buckets that line up, and a handful of
   * points correlate perfectly by chance — without this, the widest lag in the range
   * wins on noise.
   */
  readonly minSampleSize?: number;
}

/**
 * Correlates a pair at every lag in the range. A lag of `+k` asks whether the second
 * Series follows the first by `k` Buckets, so it is compared against `b[i + k]`.
 */
export function scanLags(
  a: readonly SeriesValue[],
  b: readonly SeriesValue[],
  method: CorrelationMethod,
  range: LagRange,
  options: LagScanOptions = {},
): LagScan | null {
  const tested: LagResult[] = [];
  const from = Math.min(range.min, range.max);
  const to = Math.max(range.min, range.max);
  const minSampleSize = options.minSampleSize ?? 0;

  for (let lag = from; lag <= to; lag++) {
    const result = correlate(a, shift(b, lag), method);
    if (result !== null && result.n >= minSampleSize) {
      tested.push({ lag, result });
    }
  }
  if (tested.length === 0) {
    return null;
  }

  const best = tested.reduce((strongest, candidate) =>
    stronger(candidate, strongest) ? candidate : strongest,
  );
  return { best, atZero: tested.find((entry) => entry.lag === 0) ?? null, tested };
}

/**
 * Effect size decides, but two lags can both fit perfectly — typically because one of
 * them barely overlaps at all. Then the one resting on more Buckets wins, and a tie
 * there goes to the lag closest to no lag at all, which keeps the scan deterministic.
 */
function stronger(candidate: LagResult, incumbent: LagResult): boolean {
  const difference =
    Math.abs(candidate.result.coefficient) - Math.abs(incumbent.result.coefficient);
  if (Math.abs(difference) > 1e-12) {
    return difference > 0;
  }
  if (candidate.result.n !== incumbent.result.n) {
    return candidate.result.n > incumbent.result.n;
  }
  return Math.abs(candidate.lag) < Math.abs(incumbent.lag);
}

/** Moves a Series `lag` Buckets earlier, leaving gaps where it has run out of data. */
export function shift(values: readonly SeriesValue[], lag: number): readonly SeriesValue[] {
  if (lag === 0) {
    return values;
  }
  return values.map((_, index) => {
    const source = index + lag;
    return source >= 0 && source < values.length ? values[source] : null;
  });
}
