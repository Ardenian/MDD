import { ENTRY_DURATION, type Series } from './series-extraction';

/** Which word says what a Series' number is. */
export type SeriesWord = 'average' | 'sum' | 'entryDuration';

/** The three words, already translated by whoever renders them. */
export type SeriesWords = Readonly<Record<SeriesWord, string>>;

type NamedSeries = Pick<Series, 'path' | 'name' | 'kind'>;

/**
 * The part of a label that is the user's own words. A synthetic duration has no Field
 * name to show — `entryDuration` is an internal marker, never something to put on screen
 * — so its path stands alone and the word carries the rest.
 */
export function seriesText(series: NamedSeries): string {
  const name = series.name === ENTRY_DURATION ? '' : series.name;
  return [series.path, name].filter((part) => part !== '').join(' · ');
}

/**
 * A mean and a total of one Field are identical by name, so which is which is said out
 * loud rather than left to be assumed. A fraction or a count has nothing to be told
 * apart from, so it gets no word.
 */
export function seriesWord(series: NamedSeries): SeriesWord | null {
  if (series.name === ENTRY_DURATION) {
    return 'entryDuration';
  }
  switch (series.kind) {
    case 'numeric':
      return 'average';
    case 'sum':
      return 'sum';
    default:
      return null;
  }
}

/**
 * The whole label as one string, for somewhere a badge cannot go — a chart legend, a
 * checkbox, an axis.
 */
export function seriesLabel(series: NamedSeries, words: SeriesWords): string {
  const word = seriesWord(series);
  const text = seriesText(series);
  return word === null ? text : `${text} (${words[word]})`;
}
