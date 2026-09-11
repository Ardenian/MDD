export interface CorrelationResult {
  readonly effectSize: number;
  readonly n: number;
  readonly pValue: number;
}

export interface ContingencyTable {
  readonly rows: number;
  readonly cols: number;
  /** counts[row][col] */
  readonly counts: readonly (readonly number[])[];
}

// ---------------------------------------------------------------------------
// Correlation methods (correlation/SPEC.md's Method table)
// ---------------------------------------------------------------------------

export function pearsonCorrelation(x: readonly number[], y: readonly number[]): number {
  const n = x.length;
  const meanX = mean(x);
  const meanY = mean(y);

  let numerator = 0;
  let sumSqX = 0;
  let sumSqY = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    numerator += dx * dy;
    sumSqX += dx * dx;
    sumSqY += dy * dy;
  }

  const denominator = Math.sqrt(sumSqX * sumSqY);
  return denominator === 0 ? 0 : numerator / denominator;
}

/** Numeric × numeric. Ranks both series (averaging tied ranks) then runs Pearson. */
export function spearmanCorrelation(x: readonly number[], y: readonly number[]): CorrelationResult | null {
  if (x.length !== y.length || x.length < 3) {
    return null;
  }
  const r = pearsonCorrelation(rank(x), rank(y));
  return { effectSize: r, n: x.length, pValue: correlationPValue(r, x.length) };
}

/** Numeric × binary (0/1) / fraction. Mathematically identical to Pearson. */
export function pointBiserialCorrelation(
  numeric: readonly number[],
  binary: readonly number[],
): CorrelationResult | null {
  if (numeric.length !== binary.length || numeric.length < 3) {
    return null;
  }
  const r = pearsonCorrelation(numeric, binary);
  return { effectSize: r, n: numeric.length, pValue: correlationPValue(r, numeric.length) };
}

/** Categorical × categorical, via a chi-square test on the contingency table. */
export function cramersV(table: ContingencyTable): CorrelationResult | null {
  const n = table.counts.reduce((sum, row) => sum + row.reduce((s, c) => s + c, 0), 0);
  if (n < 3) {
    return null;
  }

  const rowTotals = table.counts.map((row) => row.reduce((s, c) => s + c, 0));
  const colTotals = Array.from({ length: table.cols }, (_, col) =>
    table.counts.reduce((s, row) => s + row[col], 0),
  );

  let chiSquare = 0;
  for (let r = 0; r < table.rows; r++) {
    for (let c = 0; c < table.cols; c++) {
      const expected = (rowTotals[r] * colTotals[c]) / n;
      if (expected > 0) {
        chiSquare += (table.counts[r][c] - expected) ** 2 / expected;
      }
    }
  }

  const degreesOfFreedom = (table.rows - 1) * (table.cols - 1);
  if (degreesOfFreedom === 0) {
    return { effectSize: 0, n, pValue: 1 };
  }

  const v = Math.sqrt(chiSquare / (n * Math.min(table.rows - 1, table.cols - 1)));
  return { effectSize: v, n, pValue: chiSquarePValue(chiSquare, degreesOfFreedom) };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mean(values: readonly number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** 1-based ranks, averaging ranks across tied values. */
function rank(values: readonly number[]): number[] {
  const order = values.map((_, index) => index).sort((a, b) => values[a] - values[b]);
  const ranks = new Array<number>(values.length);

  let i = 0;
  while (i < order.length) {
    let j = i;
    while (j + 1 < order.length && values[order[j + 1]] === values[order[i]]) {
      j++;
    }
    const averageRank = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) {
      ranks[order[k]] = averageRank;
    }
    i = j + 1;
  }

  return ranks;
}

function correlationPValue(r: number, n: number): number {
  if (Math.abs(r) >= 1) {
    return 0;
  }
  const degreesOfFreedom = n - 2;
  const t = r * Math.sqrt(degreesOfFreedom / (1 - r * r));
  return studentTTwoTailedPValue(t, degreesOfFreedom);
}

// --- Student's t two-tailed p-value, via the regularized incomplete beta function ---

function studentTTwoTailedPValue(t: number, degreesOfFreedom: number): number {
  const x = degreesOfFreedom / (degreesOfFreedom + t * t);
  return regularizedIncompleteBeta(x, degreesOfFreedom / 2, 0.5);
}

// --- Chi-square upper-tail p-value, via the regularized incomplete gamma function ---

function chiSquarePValue(chiSquare: number, degreesOfFreedom: number): number {
  return 1 - regularizedLowerIncompleteGamma(degreesOfFreedom / 2, chiSquare / 2);
}

// --- Numerical primitives (Lanczos log-gamma; incomplete gamma/beta via series and
//     continued fractions — the standard Numerical-Recipes-style algorithms) ---

const LANCZOS_G = 7;
const LANCZOS_COEFFICIENTS = [
  0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
  -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
  1.5056327351493116e-7,
];

function logGamma(x: number): number {
  if (x < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
  }
  const shifted = x - 1;
  let a = LANCZOS_COEFFICIENTS[0];
  const t = shifted + LANCZOS_G + 0.5;
  for (let i = 1; i < LANCZOS_COEFFICIENTS.length; i++) {
    a += LANCZOS_COEFFICIENTS[i] / (shifted + i);
  }
  return 0.5 * Math.log(2 * Math.PI) + (shifted + 0.5) * Math.log(t) - t + Math.log(a);
}

const MIN_POSITIVE = 1e-300;
const MAX_ITERATIONS = 200;
const CONVERGENCE_EPSILON = 1e-15;

function regularizedLowerIncompleteGamma(a: number, x: number): number {
  if (x <= 0) {
    return 0;
  }

  if (x < a + 1) {
    let sum = 1 / a;
    let term = sum;
    let n = a;
    for (let i = 0; i < MAX_ITERATIONS; i++) {
      n += 1;
      term *= x / n;
      sum += term;
      if (Math.abs(term) < Math.abs(sum) * CONVERGENCE_EPSILON) {
        break;
      }
    }
    return sum * Math.exp(-x + a * Math.log(x) - logGamma(a));
  }

  // Continued fraction for the upper tail Q(a, x); P = 1 - Q.
  let b = x + 1 - a;
  let c = 1 / MIN_POSITIVE;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i <= MAX_ITERATIONS; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < MIN_POSITIVE) d = MIN_POSITIVE;
    c = b + an / c;
    if (Math.abs(c) < MIN_POSITIVE) c = MIN_POSITIVE;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < CONVERGENCE_EPSILON) {
      break;
    }
  }
  const q = Math.exp(-x + a * Math.log(x) - logGamma(a)) * h;
  return 1 - q;
}

function regularizedIncompleteBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;

  const logBetaFn = logGamma(a) + logGamma(b) - logGamma(a + b);
  const front = Math.exp(a * Math.log(x) + b * Math.log(1 - x) - logBetaFn);

  if (x < (a + 1) / (a + b + 2)) {
    return (front * betaContinuedFraction(x, a, b)) / a;
  }
  return 1 - (front * betaContinuedFraction(1 - x, b, a)) / b;
}

function betaContinuedFraction(x: number, a: number, b: number): number {
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;

  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < MIN_POSITIVE) d = MIN_POSITIVE;
  d = 1 / d;
  let h = d;

  for (let m = 1; m <= MAX_ITERATIONS; m++) {
    const m2 = 2 * m;

    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < MIN_POSITIVE) d = MIN_POSITIVE;
    c = 1 + aa / c;
    if (Math.abs(c) < MIN_POSITIVE) c = MIN_POSITIVE;
    d = 1 / d;
    h *= d * c;

    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < MIN_POSITIVE) d = MIN_POSITIVE;
    c = 1 + aa / c;
    if (Math.abs(c) < MIN_POSITIVE) c = MIN_POSITIVE;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < CONVERGENCE_EPSILON) {
      break;
    }
  }

  return h;
}
