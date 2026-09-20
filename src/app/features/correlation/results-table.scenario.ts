import { scenario } from '../../../../playwright/gallery/scenario';
import type { ResultSort } from './results-sort';
import { provideCorrelationTranslations } from './i18n/correlation-translations';
import type { PairResult } from './discovery';
import { DEFAULT_RESULT_SORT } from './results-sort';
import { ResultsTable } from './results-table';
import { ENTRY_DURATION, type Series } from './series-extraction';

function series(id: string, path: string, name: string, kind: Series['kind'] = 'numeric'): Series {
  return { id, path, name, kind, source: id, trackerId: `${id}-tracker`, values: [] };
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

/**
 * Three findings of different strengths, sample sizes and lags — enough for sorting to
 * have something to say. No ports and no Store: the table is presentation-only, so the
 * rows are simply handed to it.
 */
export const ranked = scenario({
  component: ResultsTable,
  providers: [provideCorrelationTranslations()],
  inputs: {
    results: [
      pair('weak', { coefficient: 0.2, n: 80, lag: -2, a: series('w-a', 'Sleep', 'Hours') }),
      pair('strong', { coefficient: -0.9, n: 12, lag: 3, a: series('s-a', 'Apple', 'Count') }),
      pair('middling', { coefficient: 0.6, n: 40, lag: 1, a: series('m-a', 'Zebra', 'Count') }),
    ],
    pinnedIds: [],
    currentSort: DEFAULT_RESULT_SORT,
  },
  // The table asks to be sorted and re-renders from the answer; the Correlation page is
  // what answers, so the scenario has to answer too.
  bindings: { sort: (value: ResultSort) => ({ currentSort: value }) },
});

/**
 * One pair of readings of the same Field — a mean against a total — plus a synthetic
 * duration. Which reading a number is has to be legible without opening anything.
 */
export const readings = scenario({
  component: ResultsTable,
  providers: [provideCorrelationTranslations()],
  inputs: {
    results: [
      pair('totals', {
        a: series('t-a', 'Meal → Protein', 'grams', 'sum'),
        b: series('t-b', 'Sleep', ENTRY_DURATION),
      }),
      pair('means', {
        a: series('m-a', 'Meal → Protein', 'grams'),
        b: series('m-b', 'Health', 'headache', 'fraction'),
      }),
    ],
    pinnedIds: [],
    currentSort: DEFAULT_RESULT_SORT,
  },
  bindings: { sort: (value: ResultSort) => ({ currentSort: value }) },
});
