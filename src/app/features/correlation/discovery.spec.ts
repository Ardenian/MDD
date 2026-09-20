import type { Guardrails } from '../../data/model/settings';
import type { SeriesValue } from './correlation-stats';
import {
  candidatePairs,
  type DiscoveryOptions,
  methodFor,
  type PairResult,
  runDiscovery,
} from './discovery';
import { scanLags } from './lag-scan';
import { type Series, type SeriesKind, seriesInScope } from './series-extraction';
import { adjustedPValues, benjaminiHochberg } from './significance';

function series(
  id: string,
  values: readonly SeriesValue[],
  kind: SeriesKind = 'numeric',
  source = id,
): Series {
  return { id, path: 'Tracker', name: id, kind, source, trackerId: 'tracker', values };
}

const guardrails: Guardrails = {
  minSampleSize: 3,
  pThreshold: 0.05,
  benjaminiHochberg: false,
};

const options = { lagRange: { min: -2, max: 2 }, guardrails };

/** Twelve Buckets with structure, so a lag is identifiable rather than accidental. */
const wave = [1, 5, 2, 8, 3, 9, 4, 7, 2, 6, 3, 8];
const delayedWave = [null, null, ...wave.slice(0, 10)];

/** One correlation of one pair at one Lag — the unit the correction ranges over. */
interface ScannedTest {
  readonly pairId: string;
  readonly lag: number;
  readonly p: number;
}

/**
 * Every Test a scan must correct over, rebuilt from `scanLags` rather than read back off
 * the `DiscoveryResult`. The point of these assertions is the denominator, so restating
 * whatever `runDiscovery` happened to produce would prove nothing.
 */
function everyTest(input: readonly Series[], scan: DiscoveryOptions): readonly ScannedTest[] {
  const ordered = [...input].sort((left, right) => left.id.localeCompare(right.id));
  const tests: ScannedTest[] = [];
  for (const [a, b] of candidatePairs(ordered)) {
    const result = scanLags(a.values, b.values, methodFor(a, b), scan.lagRange, {
      minSampleSize: scan.guardrails.minSampleSize,
    });
    if (result === null) {
      continue;
    }
    for (const test of result.tested) {
      tests.push({ pairId: `${a.id}::${b.id}`, lag: test.lag, p: test.result.p });
    }
  }
  return tests;
}

/** Where a displayed row's own Test sits in that full list. */
function ownTest(tests: readonly ScannedTest[], row: PairResult): number {
  return tests.findIndex((test) => test.pairId === row.id && test.lag === row.lag);
}

describe('candidatePairs', () => {
  it('pairs every Series with every other, once', () => {
    const pairs = candidatePairs([series('a', []), series('b', []), series('c', [])]);

    expect(pairs.map(([left, right]) => `${left.id}${right.id}`)).toEqual(['ab', 'ac', 'bc']);
  });

  it('never pairs a Series with itself', () => {
    expect(candidatePairs([series('a', [])])).toEqual([]);
  });

  it('skips two Series from the same source, which are tied by arithmetic', () => {
    const low = series('energy-low', [], 'fraction', 'sleep|Energy');
    const high = series('energy-high', [], 'fraction', 'sleep|Energy');
    const other = series('cups', [], 'numeric', 'coffee|Cups');

    const pairs = candidatePairs([low, high, other]);

    expect(pairs).toHaveLength(2);
    expect(pairs.some(([a, b]) => a.source === b.source)).toBe(false);
  });
});

describe('methodFor', () => {
  it('ranks two continuous Series against each other', () => {
    expect(methodFor(series('a', [], 'numeric'), series('b', [], 'occurrence'))).toBe('spearman');
  });

  it('uses point-biserial as soon as one side is a fraction', () => {
    expect(methodFor(series('a', [], 'numeric'), series('b', [], 'fraction'))).toBe(
      'point-biserial',
    );
    expect(methodFor(series('a', [], 'tag'), series('b', [], 'occurrence'))).toBe('point-biserial');
  });

  it('treats a total as continuous, the same as a mean', () => {
    expect(methodFor(series('a', [], 'sum'), series('b', [], 'numeric'))).toBe('spearman');
    expect(methodFor(series('a', [], 'sum'), series('b', [], 'fraction'))).toBe('point-biserial');
  });
});

describe('runDiscovery', () => {
  it('finds a lagged relationship and reports the lag it sits at', () => {
    const result = runDiscovery([series('cause', wave), series('effect', delayedWave)], options);

    expect(result.results).toHaveLength(1);
    expect(result.results[0].lag).toBe(2);
    expect(Math.abs(result.results[0].coefficient)).toBeCloseTo(1, 10);
  });

  it('reports the same pair at no lag beside the lag it chose', () => {
    const result = runDiscovery([series('cause', wave), series('effect', delayedWave)], options);

    expect(result.results[0].atZero).toBeDefined();
    expect(Math.abs(result.results[0].atZero?.coefficient ?? 1)).toBeLessThan(1);
  });

  it('excludes a pair with fewer overlapping Buckets than the guardrail allows', () => {
    const shortA = series('a', [1, 5, 2, null, null, null, null, null, null, null, null, null]);
    const shortB = series('b', [2, 6, 3, null, null, null, null, null, null, null, null, null]);

    const result = runDiscovery([shortA, shortB], {
      ...options,
      guardrails: { ...guardrails, minSampleSize: 10 },
    });

    expect(result.results).toEqual([]);
  });

  it('hides a pair whose p-value misses the threshold', () => {
    const noise = series('noise', [1, 9, 2, 8, 3, 7, 4, 6, 5, 5, 1, 9]);
    const other = series('other', [5, 1, 8, 2, 9, 3, 1, 7, 2, 8, 4, 4]);

    const strict = runDiscovery([noise, other], {
      ...options,
      guardrails: { ...guardrails, pThreshold: 0.000001 },
    });

    expect(strict.results).toEqual([]);
  });

  it('keeps a rejected pair, flagged, when asked to show everything', () => {
    const noise = series('noise', [1, 9, 2, 8, 3, 7, 4, 6, 5, 5, 1, 9]);
    const other = series('other', [5, 1, 8, 2, 9, 3, 1, 7, 2, 8, 4, 4]);

    const shown = runDiscovery([noise, other], {
      ...options,
      guardrails: { ...guardrails, pThreshold: 0.000001 },
      showAll: true,
    });

    expect(shown.results).toHaveLength(1);
    expect(shown.results[0].significant).toBe(false);
  });

  it('ranks by effect size, strongest first', () => {
    const anchor = series('anchor', wave);
    const exact = series(
      'exact',
      wave.map((value) => value * 2),
    );
    const loose = series('loose', [2, 4, 3, 7, 4, 8, 5, 6, 3, 5, 4, 7]);

    const result = runDiscovery([anchor, exact, loose], { ...options, showAll: true });

    const strengths = result.results.map((pair) => Math.abs(pair.coefficient));
    expect(strengths).toEqual([...strengths].sort((a, b) => b - a));
  });

  it('corrects over every (pair × Lag) Test, not one per pair', () => {
    const input = [series('a', wave), series('b', delayedWave), series('c', [...wave].reverse())];
    const corrected: DiscoveryOptions = {
      ...options,
      guardrails: { ...guardrails, benjaminiHochberg: true },
      showAll: true,
    };

    const result = runDiscovery(input, corrected);
    const tests = everyTest(input, corrected);
    const pValues = tests.map((test) => test.p);
    const adjusted = adjustedPValues(pValues);
    const flags = benjaminiHochberg(pValues, corrected.guardrails.pThreshold);

    // Three pairs across a five-Lag range, every Lag resting on enough Buckets: the
    // correction's denominator is fifteen Tests, not three pairs.
    expect(result.pairs).toBe(3);
    expect(result.tested).toBe(15);
    expect(tests).toHaveLength(15);

    expect(result.results).toHaveLength(3);
    for (const row of result.results) {
      const own = ownTest(tests, row);
      expect(row.p).toBe(tests[own].p);
      expect(row.adjustedP).toBe(adjusted[own]);
      expect(row.significant).toBe(flags[own]);
    }

    // And pinned from the other side: correcting over one p per pair is a different answer.
    expect(adjustedPValues(result.results.map((row) => row.p))).not.toEqual(
      result.results.map((row) => row.adjustedP),
    );
  });

  it('reads each row at its own Test, so an off-by-one would change what it says', () => {
    const input = [series('a', wave), series('b', delayedWave), series('c', [...wave].reverse())];
    const corrected: DiscoveryOptions = {
      ...options,
      guardrails: { ...guardrails, benjaminiHochberg: true },
      showAll: true,
    };

    const result = runDiscovery(input, corrected);
    const tests = everyTest(input, corrected);
    const adjusted = adjustedPValues(tests.map((test) => test.p));

    // The three rows sit at Tests 4, 5 and 11 of fifteen — none of them at the position
    // the row itself occupies in the result list, which is what a pair-indexed lookup
    // would have read.
    expect(result.results.map((row) => ownTest(tests, row)).sort()).toEqual([11, 4, 5].sort());

    for (const row of result.results) {
      const own = ownTest(tests, row);
      // Both neighbours exist and both differ, so the fixture can actually tell an
      // off-by-one apart: a plateau in the adjusted values would make this vacuous.
      expect(own).toBeGreaterThan(0);
      expect(own).toBeLessThan(tests.length - 1);
      expect(adjusted[own - 1]).not.toBe(adjusted[own]);
      expect(adjusted[own + 1]).not.toBe(adjusted[own]);

      expect(row.adjustedP).toBe(adjusted[own]);
    }
  });

  it('does not flag a pair that only looked good among all the Lags it was tried at', () => {
    // Three unrelated Series of noise. Scanned at five Lags apiece, one of the fifteen
    // Tests lands at p 0.005 by luck alone — clearing the 0.05 threshold outright, and
    // clearing a correction that counted only the three pairs. Corrected over the fifteen
    // Tests that actually ran it does not clear, which is the point of the correction.
    const noisy = [
      series('a', [9, 4, 6, 9, 8, 2, 6, 1, 7, 4, 7, 3, 4, 5]),
      series('b', [5, 10, 5, 1, 3, 2, 7, 1, 3, 3, 5, 3, 9, 5]),
      series('c', [6, 9, 7, 7, 1, 6, 5, 6, 7, 3, 5, 10, 3, 6]),
    ];
    const lucky = 'a::b';

    const uncorrected = runDiscovery(noisy, { ...options, showAll: true });
    const before = uncorrected.results.find((row) => row.id === lucky);
    expect(before?.p).toBeLessThan(guardrails.pThreshold);
    expect(before?.significant).toBe(true);
    // The pair-counting correction this replaces let it through as well.
    const perPair = benjaminiHochberg(
      uncorrected.results.map((row) => row.p),
      guardrails.pThreshold,
    );
    expect(perPair[uncorrected.results.findIndex((row) => row.id === lucky)]).toBe(true);

    const corrected = runDiscovery(noisy, {
      ...options,
      guardrails: { ...guardrails, benjaminiHochberg: true },
      showAll: true,
    });
    const after = corrected.results.find((row) => row.id === lucky);

    expect(corrected.tested).toBe(15);
    expect(after?.significant).toBe(false);
    expect(after?.adjustedP).toBeGreaterThan(guardrails.pThreshold);
  });

  it('hides a pair the full-set correction rejected, unless asked to show everything', () => {
    const noisy = [
      series('a', [9, 4, 6, 9, 8, 2, 6, 1, 7, 4, 7, 3, 4, 5]),
      series('b', [5, 10, 5, 1, 3, 2, 7, 1, 3, 3, 5, 3, 9, 5]),
      series('c', [6, 9, 7, 7, 1, 6, 5, 6, 7, 3, 5, 10, 3, 6]),
    ];

    const corrected = runDiscovery(noisy, {
      ...options,
      guardrails: { ...guardrails, benjaminiHochberg: true },
    });

    expect(corrected.results).toEqual([]);
    // Nothing survived, but the scan still reports the work it did.
    expect(corrected.pairs).toBe(3);
    expect(corrected.tested).toBe(15);
  });

  it('reports progress as it works through the pairs', () => {
    const seen: number[] = [];

    runDiscovery([series('a', wave), series('b', delayedWave), series('c', wave)], options, {
      onProgress: (completed, total) => seen.push(completed / total),
    });

    expect(seen).toEqual([1 / 3, 2 / 3, 1]);
  });

  it('stops where it was cancelled and counts only the work it actually did', () => {
    let calls = 0;

    const result = runDiscovery(
      [series('a', wave), series('b', delayedWave), series('c', wave)],
      { ...options, showAll: true },
      { isCancelled: () => ++calls > 1 },
    );

    expect(result.cancelled).toBe(true);
    // One pair of the three, at five Lags. A cancelled scan corrects over — and reports
    // — the Tests it ran, never a count implying pairs it never reached.
    expect(result.pairs).toBe(1);
    expect(result.tested).toBe(5);
  });

  it('is deterministic for a fixed dataset', () => {
    const input = [
      series('a', wave),
      series('b', delayedWave),
      series('c', wave.slice().reverse()),
    ];

    const first = runDiscovery(input, { ...options, showAll: true }).results.map((pair) => pair.id);
    const second = runDiscovery([...input].reverse(), { ...options, showAll: true }).results.map(
      (pair) => pair.id,
    );

    expect(first).toEqual(second);
  });

  it('has nothing to report for a single Series', () => {
    expect(runDiscovery([series('a', wave)], options).results).toEqual([]);
  });
});

describe('Series scope', () => {
  /** Three Series, so leaving one out is visible in the pair count. */
  const input = [series('a', wave), series('b', delayedWave), series('c', [...wave].reverse())];

  it('pairs only the Series left in scope, and never the ones filtered out', () => {
    const everything = runDiscovery(input, options);
    const scoped = runDiscovery(seriesInScope(input, ['a', 'b']), options);

    expect(everything.pairs).toBe(3);
    expect(scoped.pairs).toBe(1);
    // Fewer pairs means fewer Tests, so the correction's bar moves with the scope.
    expect(scoped.tested).toBeLessThan(everything.tested);
  });

  it('corrects over only the Tests the narrowed scan ran', () => {
    const scoped = seriesInScope(input, ['a', 'b']);

    expect(runDiscovery(scoped, options).tested).toBe(everyTest(scoped, options).length);
  });
});
