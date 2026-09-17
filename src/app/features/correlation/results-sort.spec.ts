import type { PairResult } from './discovery';
import type { Series } from './series-extraction';
import { DEFAULT_RESULT_SORT, nextSort, sortResults } from './results-sort';

function series(id: string, path: string, name: string): Series {
  return { id, path, name, kind: 'numeric', source: id, trackerId: 'tracker', values: [] };
}

function pair(id: string, overrides: Partial<PairResult> = {}): PairResult {
  return {
    id,
    a: series(`${id}-a`, 'Sleep', 'Hours'),
    b: series(`${id}-b`, 'Coffee', 'Cups'),
    method: 'spearman',
    coefficient: 0.5,
    lag: 0,
    n: 20,
    p: 0.01,
    adjustedP: 0.02,
    significant: true,
    atZero: null,
    ...overrides,
  };
}

describe('nextSort', () => {
  it('reverses the direction when the same column is clicked again', () => {
    expect(nextSort({ column: 'n', direction: 'desc' }, 'n')).toEqual({
      column: 'n',
      direction: 'asc',
    });
  });

  it('starts a numeric column at its large end, which is the interesting one', () => {
    expect(nextSort(DEFAULT_RESULT_SORT, 'n')).toEqual({ column: 'n', direction: 'desc' });
  });

  it('starts a name column alphabetically', () => {
    expect(nextSort(DEFAULT_RESULT_SORT, 'seriesA')).toEqual({
      column: 'seriesA',
      direction: 'asc',
    });
  });
});

describe('sortResults', () => {
  it('ranks by the strength of the relationship, not its direction', () => {
    const strongNegative = pair('strong', { coefficient: -0.9 });
    const weakPositive = pair('weak', { coefficient: 0.2 });

    const sorted = sortResults([weakPositive, strongNegative], DEFAULT_RESULT_SORT);

    expect(sorted.map((result) => result.id)).toEqual(['strong', 'weak']);
  });

  it('sorts by sample size when asked', () => {
    const small = pair('small', { n: 12 });
    const large = pair('large', { n: 80 });

    expect(
      sortResults([small, large], { column: 'n', direction: 'desc' }).map((result) => result.id),
    ).toEqual(['large', 'small']);
  });

  it('sorts by lag, keeping negatives below positives', () => {
    const early = pair('early', { lag: -2 });
    const late = pair('late', { lag: 3 });

    expect(
      sortResults([late, early], { column: 'lag', direction: 'asc' }).map((result) => result.id),
    ).toEqual(['early', 'late']);
  });

  it('puts significant results first, then those with the most room to spare', () => {
    const rejected = pair('rejected', { significant: false, adjustedP: 0.4 });
    const clear = pair('clear', { significant: true, adjustedP: 0.001 });
    const marginal = pair('marginal', { significant: true, adjustedP: 0.049 });

    const sorted = sortResults([marginal, rejected, clear], {
      column: 'significance',
      direction: 'desc',
    });

    expect(sorted.map((result) => result.id)).toEqual(['clear', 'marginal', 'rejected']);
  });

  it('sorts by Series name alphabetically', () => {
    const zebra = pair('zebra', { a: series('z', 'Zebra', 'Count') });
    const apple = pair('apple', { a: series('a', 'Apple', 'Count') });

    expect(
      sortResults([zebra, apple], { column: 'seriesA', direction: 'asc' }).map(
        (result) => result.id,
      ),
    ).toEqual(['apple', 'zebra']);
  });

  it('is stable: equal rows keep the ranking Discovery gave them', () => {
    const first = pair('first', { n: 20 });
    const second = pair('second', { n: 20 });
    const third = pair('third', { n: 20 });

    expect(
      sortResults([first, second, third], { column: 'n', direction: 'desc' }).map(
        (result) => result.id,
      ),
    ).toEqual(['first', 'second', 'third']);
  });

  it('leaves the input alone', () => {
    const results = [pair('a', { n: 1 }), pair('b', { n: 9 })];

    sortResults(results, { column: 'n', direction: 'desc' });

    expect(results.map((result) => result.id)).toEqual(['a', 'b']);
  });
});
