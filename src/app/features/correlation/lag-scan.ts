import { bucketIndexForKey, type BucketSize } from './bucketing';
import type { CorrelationResult } from './correlation-stats';
import type { Signal, SignalPoint } from './signal-extraction';

export interface LagRange {
  readonly min: number;
  readonly max: number;
}

export interface LagScanResult {
  readonly zeroLag: CorrelationResult | null;
  readonly bestLag: number;
  readonly bestResult: CorrelationResult | null;
}

const MIN_POINTS_FOR_CORRELATION = 3;

/**
 * Scans every Lag in `lagRange` for one Signal pair, reporting the zero-Lag result
 * (always attempted) alongside whichever Lag has the strongest |effect size|
 * (`correlation/SPEC.md`). `correlate` is one of `spearmanCorrelation` /
 * `pointBiserialCorrelation` / a `cramersV`-shaped adapter — this module doesn't pick
 * a method, `discovery` does, based on the pair's Signal kinds.
 */
export function scanLags(
  signalA: Signal,
  signalB: Signal,
  bucketSize: BucketSize,
  lagRange: LagRange,
  correlate: (a: readonly number[], b: readonly number[]) => CorrelationResult | null,
): LagScanResult {
  let zeroLag: CorrelationResult | null = null;
  let bestLag = 0;
  let bestResult: CorrelationResult | null = null;

  for (let lag = lagRange.min; lag <= lagRange.max; lag++) {
    const { a, b } = pairAtLag(signalA.points, signalB.points, bucketSize, lag);
    if (a.length < MIN_POINTS_FOR_CORRELATION) {
      continue;
    }

    const result = correlate(a, b);
    if (!result) {
      continue;
    }

    if (lag === 0) {
      zeroLag = result;
    }
    if (!bestResult || Math.abs(result.effectSize) > Math.abs(bestResult.effectSize)) {
      bestLag = lag;
      bestResult = result;
    }
  }

  return { zeroLag, bestLag, bestResult };
}

/** Pairs `signalA[index]` with `signalB[index + lag]` for every Bucket index where both
 *  exist — lag > 0 means B's pattern trails A's by that many Buckets. */
function pairAtLag(
  pointsA: readonly SignalPoint[],
  pointsB: readonly SignalPoint[],
  bucketSize: BucketSize,
  lag: number,
): { a: number[]; b: number[] } {
  const bByIndex = new Map(pointsB.map((point) => [bucketIndexForKey(point.bucketKey, bucketSize), point.value]));

  const a: number[] = [];
  const b: number[] = [];
  for (const point of pointsA) {
    const indexA = bucketIndexForKey(point.bucketKey, bucketSize);
    const valueB = bByIndex.get(indexA + lag);
    if (valueB !== undefined) {
      a.push(point.value);
      b.push(valueB);
    }
  }

  return { a, b };
}
