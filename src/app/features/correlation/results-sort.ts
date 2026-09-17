import type { PairResult } from './discovery';

export type ResultColumn = 'seriesA' | 'seriesB' | 'lag' | 'coefficient' | 'n' | 'significance';

export type SortDirection = 'asc' | 'desc';

export interface ResultSort {
  readonly column: ResultColumn;
  readonly direction: SortDirection;
}

export const DEFAULT_RESULT_SORT: ResultSort = { column: 'coefficient', direction: 'desc' };

/**
 * Clicking a header sorts by it, descending first for the numeric columns — the
 * interesting end of effect size, sample size and significance is the large end — and
 * ascending first for the two name columns. Clicking the same header again reverses it.
 */
export function nextSort(current: ResultSort, column: ResultColumn): ResultSort {
  if (current.column === column) {
    return { column, direction: current.direction === 'asc' ? 'desc' : 'asc' };
  }
  return { column, direction: column === 'seriesA' || column === 'seriesB' ? 'asc' : 'desc' };
}

/**
 * Stable: equal rows keep the order they arrived in, which is the ranking Discovery
 * produced. `Array.prototype.sort` is stable in every engine this app supports, so this
 * only has to avoid inventing a tie-break of its own.
 */
export function sortResults(
  results: readonly PairResult[],
  sort: ResultSort,
): readonly PairResult[] {
  const direction = sort.direction === 'asc' ? 1 : -1;
  return [...results].sort((left, right) => direction * compare(left, right, sort.column));
}

function compare(left: PairResult, right: PairResult, column: ResultColumn): number {
  switch (column) {
    case 'seriesA':
      return labelOf(left, 'a').localeCompare(labelOf(right, 'a'));
    case 'seriesB':
      return labelOf(left, 'b').localeCompare(labelOf(right, 'b'));
    case 'lag':
      return left.lag - right.lag;
    case 'coefficient':
      // Direction is a property of the relationship, not its strength: −0.8 and +0.8 are
      // equally strong findings, so the column ranks by magnitude.
      return Math.abs(left.coefficient) - Math.abs(right.coefficient);
    case 'n':
      return left.n - right.n;
    case 'significance':
      // Significant first, then by how much room each had to spare.
      return (
        Number(left.significant) - Number(right.significant) || right.adjustedP - left.adjustedP
      );
  }
}

function labelOf(result: PairResult, side: 'a' | 'b'): string {
  const series = result[side];
  return `${series.path} ${series.name}`.trim();
}
