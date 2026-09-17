import type { Guardrails } from '../../data/model/settings';
import type { SeriesValue } from './correlation-stats';
import { candidatePairs, methodFor, runDiscovery } from './discovery';
import type { Series, SeriesKind } from './series-extraction';

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

  it('applies Benjamini–Hochberg across the whole scan when it is on', () => {
    const corrected = runDiscovery([series('a', wave), series('b', delayedWave)], {
      ...options,
      guardrails: { ...guardrails, benjaminiHochberg: true },
      showAll: true,
    });

    // A single perfect pair survives correction; its adjusted p is still reported.
    expect(corrected.results[0].adjustedP).toBeGreaterThanOrEqual(corrected.results[0].p);
  });

  it('reports progress as it works through the pairs', () => {
    const seen: number[] = [];

    runDiscovery([series('a', wave), series('b', delayedWave), series('c', wave)], options, {
      onProgress: (completed, total) => seen.push(completed / total),
    });

    expect(seen).toEqual([1 / 3, 2 / 3, 1]);
  });

  it('stops where it was cancelled and returns what it already had', () => {
    let calls = 0;

    const result = runDiscovery(
      [series('a', wave), series('b', delayedWave), series('c', wave)],
      { ...options, showAll: true },
      { isCancelled: () => ++calls > 1 },
    );

    expect(result.cancelled).toBe(true);
    expect(result.tested).toBe(1);
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
