/**
 * The statistics behind every Correlation. Framework-free and dependency-free: the
 * p-values come from an incomplete-beta implementation here rather than a stats library,
 * so the whole scan stays inside the app's own bundle.
 */

/** A Bucket with no data on one side is not evidence of anything — it is a gap. */
export type SeriesValue = number | null;

export type CorrelationMethod = 'spearman' | 'point-biserial';

export interface CorrelationResult {
  readonly method: CorrelationMethod;
  /** Effect size in −1..1. */
  readonly coefficient: number;
  /** Overlapping Buckets the coefficient was computed from. */
  readonly n: number;
  readonly p: number;
}

/** Below this, a coefficient says nothing at all, so none is reported. */
const MIN_PAIRS = 3;

export function correlate(
  a: readonly SeriesValue[],
  b: readonly SeriesValue[],
  method: CorrelationMethod,
): CorrelationResult | null {
  const pairs = overlapping(a, b);
  if (pairs.length < MIN_PAIRS) {
    return null;
  }

  const left = pairs.map(([value]) => value);
  const right = pairs.map(([, value]) => value);
  const coefficient =
    method === 'spearman' ? pearson(rank(left), rank(right)) : pearson(left, right);
  if (coefficient === null) {
    // One side never varies, so there is no relationship to describe.
    return null;
  }

  return { method, coefficient, n: pairs.length, p: pValue(coefficient, pairs.length) };
}

/** Only Buckets where both Series have a value can say anything about the pair. */
export function overlapping(
  a: readonly SeriesValue[],
  b: readonly SeriesValue[],
): readonly (readonly [number, number])[] {
  const pairs: (readonly [number, number])[] = [];
  const length = Math.min(a.length, b.length);
  for (let index = 0; index < length; index++) {
    const left = a[index];
    const right = b[index];
    if (left !== null && right !== null && Number.isFinite(left) && Number.isFinite(right)) {
      pairs.push([left, right]);
    }
  }
  return pairs;
}

/** Returns `null` when either side has no variance, where correlation is undefined. */
export function pearson(a: readonly number[], b: readonly number[]): number | null {
  const n = Math.min(a.length, b.length);
  if (n < MIN_PAIRS) {
    return null;
  }
  const meanA = mean(a);
  const meanB = mean(b);
  let covariance = 0;
  let varianceA = 0;
  let varianceB = 0;
  for (let index = 0; index < n; index++) {
    const deviationA = a[index] - meanA;
    const deviationB = b[index] - meanB;
    covariance += deviationA * deviationB;
    varianceA += deviationA * deviationA;
    varianceB += deviationB * deviationB;
  }
  if (varianceA === 0 || varianceB === 0) {
    return null;
  }
  const coefficient = covariance / Math.sqrt(varianceA * varianceB);
  // Guard the arithmetic, not the mathematics: rounding can push a perfect fit past 1.
  return Math.max(-1, Math.min(1, coefficient));
}

/** Ranks, averaging ties — which is what makes Spearman well-defined on repeated values. */
export function rank(values: readonly number[]): readonly number[] {
  const order = values
    .map((value, index) => ({ value, index }))
    .sort((left, right) => left.value - right.value);

  const ranks = new Array<number>(values.length);
  let start = 0;
  while (start < order.length) {
    let end = start;
    while (end + 1 < order.length && order[end + 1].value === order[start].value) {
      end++;
    }
    const shared = (start + end) / 2 + 1;
    for (let index = start; index <= end; index++) {
      ranks[order[index].index] = shared;
    }
    start = end + 1;
  }
  return ranks;
}

/** Two-tailed p for a correlation coefficient, via the t distribution with n − 2 df. */
export function pValue(coefficient: number, n: number): number {
  const df = n - 2;
  if (df <= 0) {
    return 1;
  }
  if (Math.abs(coefficient) >= 1) {
    return 0;
  }
  const t = coefficient * Math.sqrt(df / (1 - coefficient * coefficient));
  return studentTTwoTailed(t, df);
}

export function studentTTwoTailed(t: number, df: number): number {
  return incompleteBeta(df / (df + t * t), df / 2, 0.5);
}

function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** Regularised incomplete beta I_x(a, b), by the standard continued fraction. */
function incompleteBeta(x: number, a: number, b: number): number {
  if (x <= 0) {
    return 0;
  }
  if (x >= 1) {
    return 1;
  }
  const front = Math.exp(
    logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x),
  );
  return x < (a + 1) / (a + b + 2)
    ? (front * betaContinuedFraction(x, a, b)) / a
    : 1 -
        (Math.exp(
          logGamma(a + b) - logGamma(a) - logGamma(b) + b * Math.log(1 - x) + a * Math.log(x),
        ) *
          betaContinuedFraction(1 - x, b, a)) /
          b;
}

function betaContinuedFraction(x: number, a: number, b: number): number {
  const tiny = 1e-30;
  let c = 1;
  let d = 1 - ((a + b) * x) / (a + 1);
  if (Math.abs(d) < tiny) {
    d = tiny;
  }
  d = 1 / d;
  let fraction = d;

  for (let m = 1; m <= 200; m++) {
    const even = (m * (b - m) * x) / ((a + 2 * m - 1) * (a + 2 * m));
    d = 1 + even * d;
    if (Math.abs(d) < tiny) {
      d = tiny;
    }
    c = 1 + even / c;
    if (Math.abs(c) < tiny) {
      c = tiny;
    }
    d = 1 / d;
    fraction *= d * c;

    const odd = (-(a + m) * (a + b + m) * x) / ((a + 2 * m) * (a + 2 * m + 1));
    d = 1 + odd * d;
    if (Math.abs(d) < tiny) {
      d = tiny;
    }
    c = 1 + odd / c;
    if (Math.abs(c) < tiny) {
      c = tiny;
    }
    d = 1 / d;
    const step = d * c;
    fraction *= step;

    if (Math.abs(step - 1) < 1e-12) {
      break;
    }
  }
  return fraction;
}

/** Lanczos approximation; accurate well past the precision a p-value is read at. */
function logGamma(value: number): number {
  const coefficients = [
    76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155,
    0.1208650973866179e-2, -0.5395239384953e-5,
  ];
  let y = value;
  const x = value;
  let temporary = x + 5.5;
  temporary -= (x + 0.5) * Math.log(temporary);
  let series = 1.000000000190015;
  for (const coefficient of coefficients) {
    series += coefficient / ++y;
  }
  return -temporary + Math.log((2.5066282746310005 * series) / x);
}
