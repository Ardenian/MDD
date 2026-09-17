import type { SeriesValue } from './correlation-stats';
import { scanLags, shift } from './lag-scan';

/**
 * `delayed` is `varied` two Buckets later: what happened on Monday shows up on Wednesday.
 * The Series deliberately rises and falls — a Series that only ever climbs matches itself
 * at every shift, so no lag could be identified from it.
 */
const varied: readonly SeriesValue[] = [1, 5, 2, 8, 3, 9, 4, 7];
const delayed: readonly SeriesValue[] = [null, null, 1, 5, 2, 8, 3, 9];

describe('shift', () => {
  it('leaves a Series alone at lag 0', () => {
    expect(shift([1, 2, 3], 0)).toEqual([1, 2, 3]);
  });

  it('moves a Series earlier for a positive lag, leaving a gap at the end', () => {
    expect(shift([1, 2, 3], 1)).toEqual([2, 3, null]);
  });

  it('moves it later for a negative lag, leaving a gap at the start', () => {
    expect(shift([1, 2, 3], -1)).toEqual([null, 1, 2]);
  });

  it('is all gaps once the lag exceeds the Series length', () => {
    expect(shift([1, 2, 3], 5)).toEqual([null, null, null]);
  });
});

describe('scanLags', () => {
  const range = { min: -3, max: 3 };

  it('finds the lag a delayed Series actually sits at', () => {
    const scan = scanLags(varied, delayed, 'spearman', range);

    expect(scan?.best.lag).toBe(2);
    expect(Math.abs(scan?.best.result.coefficient ?? 0)).toBeCloseTo(1, 10);
  });

  it('finds a negative lag symmetrically', () => {
    const scan = scanLags(delayed, varied, 'spearman', range);

    expect(scan?.best.lag).toBe(-2);
    expect(Math.abs(scan?.best.result.coefficient ?? 0)).toBeCloseTo(1, 10);
  });

  it('always reports lag 0 beside the best, so the two can be read against each other', () => {
    const scan = scanLags(varied, delayed, 'spearman', range);

    expect(scan?.atZero?.lag).toBe(0);
    expect(scan?.atZero?.result.coefficient).toBeDefined();
  });

  it('tests every lag in the range', () => {
    const scan = scanLags(varied, varied, 'spearman', { min: -1, max: 2 });

    expect(scan?.tested.map((entry) => entry.lag)).toEqual([-1, 0, 1, 2]);
  });

  it('scans a zero-width range as lag 0 alone', () => {
    const scan = scanLags(varied, varied, 'spearman', { min: 0, max: 0 });

    expect(scan?.tested.map((entry) => entry.lag)).toEqual([0]);
    expect(scan?.best.lag).toBe(0);
  });

  it('reads a range given the wrong way round as the range it describes', () => {
    const scan = scanLags(varied, varied, 'spearman', { min: 2, max: -1 });

    expect(scan?.tested.map((entry) => entry.lag)).toEqual([-1, 0, 1, 2]);
  });

  it('prefers the strongest relationship whichever way it points', () => {
    const mirrored: readonly SeriesValue[] = varied.map((value) => -(value as number));
    const scan = scanLags(varied, mirrored, 'spearman', range);

    expect(scan?.best.result.coefficient).toBeCloseTo(-1, 10);
    expect(scan?.best.lag).toBe(0);
  });

  it('ignores lags that leave fewer Buckets than the guardrail asks for', () => {
    const scan = scanLags(varied, delayed, 'spearman', range, { minSampleSize: 5 });

    // Lag −3 leaves only three Buckets, and three points fit almost anything.
    expect(scan?.tested.map((entry) => entry.lag)).not.toContain(-3);
    expect(scan?.best.lag).toBe(2);
  });

  it('prefers the lag resting on more Buckets when two fit equally well', () => {
    const scan = scanLags(varied, delayed, 'spearman', range);
    const spurious = scan?.tested.find((entry) => entry.lag === -3);

    // Lag −3 leaves three Buckets that happen to line up perfectly — a fit that means
    // nothing. The real relationship at lag +2 rests on six, so it wins the tie rather
    // than whichever lag happened to be scanned first.
    expect(spurious?.result.n).toBe(3);
    expect(Math.abs(spurious?.result.coefficient ?? 0)).toBeCloseTo(1, 10);
    expect(scan?.best.lag).toBe(2);
  });

  it('has nothing to report when no lag leaves enough overlap', () => {
    expect(scanLags([1, 2, 3], [4, 5, 6], 'spearman', { min: 10, max: 12 })).toBeNull();
  });

  it('has nothing to report for a Series that never varies', () => {
    expect(scanLags([1, 1, 1, 1], [1, 2, 3, 4], 'spearman', range)).toBeNull();
  });
});
