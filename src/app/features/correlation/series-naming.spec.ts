import { ENTRY_DURATION, type Series } from './series-extraction';
import { seriesLabel, seriesText, seriesWord } from './series-naming';

const words = { average: 'Average', sum: 'Sum', entryDuration: 'Length' };

function series(path: string, name: string, kind: Series['kind'] = 'numeric') {
  return { path, name, kind };
}

describe('seriesText', () => {
  it('joins the path and the user own word for the Field', () => {
    expect(seriesText(series('Meal → Protein', 'grams'))).toBe('Meal → Protein · grams');
  });

  it('never shows the internal marker a synthetic duration carries', () => {
    expect(seriesText(series('Sleep', ENTRY_DURATION))).toBe('Sleep');
  });

  it('leaves out an empty part rather than trailing a separator', () => {
    expect(seriesText(series('Coffee', '', 'occurrence'))).toBe('Coffee');
  });
});

describe('seriesWord', () => {
  it('tells a mean and a total of the same Field apart', () => {
    expect(seriesWord(series('Meal', 'grams', 'numeric'))).toBe('average');
    expect(seriesWord(series('Meal', 'grams', 'sum'))).toBe('sum');
  });

  it('names a synthetic duration whatever its kind', () => {
    expect(seriesWord(series('Sleep', ENTRY_DURATION))).toBe('entryDuration');
  });

  it('gives a fraction or a count no word, having nothing to be told apart from', () => {
    expect(seriesWord(series('Health', 'headache', 'fraction'))).toBeNull();
    expect(seriesWord(series('Coffee', '', 'occurrence'))).toBeNull();
    expect(seriesWord(series('', 'migraine', 'tag'))).toBeNull();
  });
});

describe('seriesLabel', () => {
  it('appends the word where a badge cannot go', () => {
    expect(seriesLabel(series('Meal', 'grams', 'sum'), words)).toBe('Meal · grams (Sum)');
  });

  it('leaves an unworded Series as plain text', () => {
    expect(seriesLabel(series('Health', 'headache', 'fraction'), words)).toBe('Health · headache');
  });

  it('labels a duration by its path and its word alone', () => {
    expect(seriesLabel(series('Sleep', ENTRY_DURATION), words)).toBe('Sleep (Length)');
  });
});
