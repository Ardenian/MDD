import { computeOverlapLayout } from './calendar-layout';

describe('computeOverlapLayout', () => {
  it('gives non-overlapping items one column each', () => {
    const results = computeOverlapLayout([
      { id: 'a', start: 0, end: 10 },
      { id: 'b', start: 10, end: 20 },
    ]);

    expect(results).toEqual([
      { id: 'a', column: 0, columnCount: 1 },
      { id: 'b', column: 0, columnCount: 1 },
    ]);
  });

  it('splits two overlapping items into two columns', () => {
    const results = computeOverlapLayout([
      { id: 'a', start: 0, end: 10 },
      { id: 'b', start: 5, end: 15 },
    ]);

    expect(results.find((r) => r.id === 'a')).toEqual({ id: 'a', column: 0, columnCount: 2 });
    expect(results.find((r) => r.id === 'b')).toEqual({ id: 'b', column: 1, columnCount: 2 });
  });

  it('splits a three-way overlap into three columns', () => {
    const results = computeOverlapLayout([
      { id: 'a', start: 0, end: 10 },
      { id: 'b', start: 2, end: 8 },
      { id: 'c', start: 4, end: 12 },
    ]);

    expect(results.every((r) => r.columnCount === 3)).toBe(true);
    expect(new Set(results.map((r) => r.column)).size).toBe(3);
  });

  it('reuses a column freed by an earlier item within the same cluster', () => {
    // a spans the whole window; b is nested early in it and ends before c starts,
    // so c should reuse b's column rather than opening a third one.
    const results = computeOverlapLayout([
      { id: 'a', start: 0, end: 10 },
      { id: 'b', start: 1, end: 3 },
      { id: 'c', start: 4, end: 6 },
    ]);

    expect(results.find((r) => r.id === 'a')).toEqual({ id: 'a', column: 0, columnCount: 2 });
    expect(results.find((r) => r.id === 'b')).toEqual({ id: 'b', column: 1, columnCount: 2 });
    expect(results.find((r) => r.id === 'c')).toEqual({ id: 'c', column: 1, columnCount: 2 });
  });

  it('keeps independent clusters on the same day from inflating each other\'s columnCount', () => {
    const results = computeOverlapLayout([
      { id: 'a', start: 0, end: 10 },
      { id: 'b', start: 2, end: 8 },
      { id: 'c', start: 100, end: 110 },
    ]);

    expect(results.find((r) => r.id === 'c')).toEqual({ id: 'c', column: 0, columnCount: 1 });
  });
});
