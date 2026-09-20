import type { Guardrails, LagRange } from '../../data/model/settings';
import type { CorrelationMethod } from './correlation-stats';
import { scanLags } from './lag-scan';
import type { Series } from './series-extraction';
import { adjustedPValues, benjaminiHochberg } from './significance';

export interface DiscoveryOptions {
  readonly lagRange: LagRange;
  readonly guardrails: Guardrails;
  /** Keeps pairs that correction rejected, flagged rather than hidden. */
  readonly showAll?: boolean;
}

export interface DiscoveryHooks {
  readonly onProgress?: (completed: number, total: number) => void;
  /** Checked between pairs: a cancelled scan returns what it had, not nothing. */
  readonly isCancelled?: () => boolean;
}

export interface PairResult {
  readonly id: string;
  readonly a: Series;
  readonly b: Series;
  readonly method: CorrelationMethod;
  readonly coefficient: number;
  readonly lag: number;
  readonly n: number;
  readonly p: number;
  /** BH-adjusted across every (pair × lag) test in the scan. */
  readonly adjustedP: number;
  readonly significant: boolean;
  /** The same pair at no lag at all, for comparison against the reported lag. */
  readonly atZero: { readonly coefficient: number; readonly p: number } | null;
}

export interface DiscoveryResult {
  readonly results: readonly PairResult[];
  /**
   * Tests actually run — one per (pair × lag) correlation computed. Lags skipped for
   * want of overlapping Buckets were never run, so they are not counted here.
   */
  readonly tested: number;
  /** Pairs actually correlated, before the guardrails filtered the list. */
  readonly pairs: number;
  readonly cancelled: boolean;
}

/** One pair's reported row, plus where its own Test sits in the scan's flat Test list. */
interface ScannedPair {
  readonly row: Omit<PairResult, 'adjustedP' | 'significant'>;
  /** Index of this pair's strongest-lag Test. The row's adjusted p is read from it. */
  readonly bestTest: number;
}

/**
 * Scope → Series → pairs → lag scan → guardrails → ranked list.
 *
 * Deterministic for a fixed dataset: pairs are walked in Series-id order and ties in the
 * ranking fall back to those ids, so the same diary always produces the same list.
 */
export function runDiscovery(
  series: readonly Series[],
  options: DiscoveryOptions,
  hooks: DiscoveryHooks = {},
): DiscoveryResult {
  const steps = discoverySteps(series, options, hooks);
  let step = steps.next();
  while (step.done !== true) {
    step = steps.next();
  }
  return step.value;
}

/**
 * The same scan, yielding to the caller every `yieldEvery` pairs. A Discovery scan over a
 * year of diary is thousands of correlations; run in one go it freezes the page, and a
 * progress bar nobody can see next to a cancel button nobody can click is worse than
 * none. Everything here is plain data, so this could move to a Worker later without the
 * statistics changing.
 */
export async function runDiscoveryAsync(
  series: readonly Series[],
  options: DiscoveryOptions,
  hooks: DiscoveryHooks & {
    readonly yieldEvery?: number;
    readonly yieldTo?: () => Promise<void>;
  } = {},
): Promise<DiscoveryResult> {
  const yieldEvery = hooks.yieldEvery ?? 50;
  const yieldTo = hooks.yieldTo ?? (() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
  const steps = discoverySteps(series, options, hooks);

  let processed = 0;
  let step = steps.next();
  while (step.done !== true) {
    if (++processed % yieldEvery === 0) {
      await yieldTo();
    }
    step = steps.next();
  }
  return step.value;
}

function* discoverySteps(
  series: readonly Series[],
  options: DiscoveryOptions,
  hooks: DiscoveryHooks,
): Generator<void, DiscoveryResult> {
  const ordered = [...series].sort((left, right) => left.id.localeCompare(right.id));
  const pairs = candidatePairs(ordered);
  const found: ScannedPair[] = [];
  /**
   * Every Test the scan ran, as raw p-values: one per pair per lag, appended in pair
   * order and then in ascending lag, so the correction sees the same set in the same
   * order for the same diary. Only the strongest lag of each pair is ever displayed, but
   * all of them were run and all of them count towards the correction.
   */
  const tests: number[] = [];
  let cancelled = false;

  for (let index = 0; index < pairs.length; index++) {
    if (hooks.isCancelled?.() === true) {
      cancelled = true;
      break;
    }
    yield;
    const [a, b] = pairs[index];
    const scan = scanLags(a.values, b.values, methodFor(a, b), options.lagRange, {
      minSampleSize: options.guardrails.minSampleSize,
    });
    hooks.onProgress?.(index + 1, pairs.length);
    if (scan === null) {
      continue;
    }

    // `scan.tested` holds one Test per lag that was actually correlated, so the strongest
    // lag names its own Test unambiguously. Its position is read against where this pair's
    // Tests begin, before any of them are appended.
    const firstTest = tests.length;
    const bestTest = firstTest + scan.tested.findIndex((test) => test.lag === scan.best.lag);
    for (const test of scan.tested) {
      tests.push(test.result.p);
    }

    found.push({
      bestTest,
      row: {
        id: `${a.id}::${b.id}`,
        a,
        b,
        method: scan.best.result.method,
        coefficient: scan.best.result.coefficient,
        lag: scan.best.lag,
        n: scan.best.result.n,
        p: scan.best.result.p,
        atZero:
          scan.atZero === null
            ? null
            : { coefficient: scan.atZero.result.coefficient, p: scan.atZero.result.p },
      },
    });
  }

  return {
    results: rank(found, tests, options),
    tested: tests.length,
    pairs: found.length,
    cancelled,
  };
}

/**
 * Every unordered pair of distinct Series, minus pairs sharing a source. The options of
 * one select Field are complements — "Energy = low" and "Energy = high" move against each
 * other by arithmetic, and reporting that as a finding would bury the real ones.
 */
export function candidatePairs(series: readonly Series[]): readonly (readonly [Series, Series])[] {
  const pairs: (readonly [Series, Series])[] = [];
  for (let left = 0; left < series.length; left++) {
    for (let right = left + 1; right < series.length; right++) {
      if (series[left].source !== series[right].source) {
        pairs.push([series[left], series[right]]);
      }
    }
  }
  return pairs;
}

/**
 * Two counts, means or totals are ranked against each other (Spearman); anything
 * measured as a 0..1 fraction goes through point-biserial, which is Pearson against
 * that fraction.
 */
export function methodFor(a: Series, b: Series): CorrelationMethod {
  const continuous = (series: Series) =>
    series.kind === 'numeric' || series.kind === 'occurrence' || series.kind === 'sum';
  return continuous(a) && continuous(b) ? 'spearman' : 'point-biserial';
}

/**
 * Correction ranges over every Test the scan ran, not one per pair: picking the strongest
 * of seven lags is itself seven chances to be impressed, and a denominator of pairs alone
 * would never absorb that. Each pair still reports one row, reading its adjusted p and
 * its flag back out at the index of its own strongest-lag Test.
 *
 * A cancelled scan corrects over the Tests it actually ran, which is the only set it can
 * honestly speak for — the pairs it never reached were never lottery tickets.
 */
function rank(
  found: readonly ScannedPair[],
  tests: readonly number[],
  options: DiscoveryOptions,
): readonly PairResult[] {
  const useCorrection = options.guardrails.benjaminiHochberg;
  const adjusted = useCorrection ? adjustedPValues(tests) : tests;
  const flags = useCorrection
    ? benjaminiHochberg(tests, options.guardrails.pThreshold)
    : tests.map((p) => p <= options.guardrails.pThreshold);

  return found
    .map(({ row, bestTest }) => ({
      ...row,
      adjustedP: adjusted[bestTest],
      significant: flags[bestTest],
    }))
    .filter((result) => result.n >= options.guardrails.minSampleSize)
    .filter((result) => options.showAll === true || result.significant)
    .sort(
      (left, right) =>
        Math.abs(right.coefficient) - Math.abs(left.coefficient) || left.id.localeCompare(right.id),
    );
}
