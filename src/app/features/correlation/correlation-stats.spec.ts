import { correlate, pearson, pValue, rank, studentTTwoTailed } from './correlation-stats';

describe('rank', () => {
  it('ranks from 1 upward', () => {
    expect(rank([10, 30, 20])).toEqual([1, 3, 2]);
  });

  it('averages tied values, which is what keeps Spearman defined on repeats', () => {
    expect(rank([1, 2, 2, 3])).toEqual([1, 2.5, 2.5, 4]);
  });

  it('averages a run of three ties', () => {
    expect(rank([5, 5, 5])).toEqual([2, 2, 2]);
  });
});

describe('pearson', () => {
  it('is 1 for a perfect increasing fit', () => {
    expect(pearson([1, 2, 3, 4], [2, 4, 6, 8])).toBeCloseTo(1, 10);
  });

  it('is −1 for a perfect decreasing fit', () => {
    expect(pearson([1, 2, 3, 4], [8, 6, 4, 2])).toBeCloseTo(-1, 10);
  });

  it('matches a hand-computed value', () => {
    // Deviations [-2,-1,0,1,2] and [-1,-2,1,0,2]: covariance 8 over variances 10 and 10.
    expect(pearson([1, 2, 3, 4, 5], [2, 1, 4, 3, 5])).toBeCloseTo(0.8, 10);
  });

  it('has no answer when one side never varies', () => {
    expect(pearson([1, 1, 1, 1], [1, 2, 3, 4])).toBeNull();
  });
});

describe('studentTTwoTailed', () => {
  it.each([
    [2.306, 8, 0.05],
    [1.86, 8, 0.1],
    [3.355, 8, 0.01],
    [2.228, 10, 0.05],
    [2.086, 20, 0.05],
    [1.984, 100, 0.05],
  ])('returns t=%f at df=%i as p≈%f, the published critical value', (t, df, alpha) => {
    // Published critical values are rounded to three decimals, so the p they produce is
    // only accurate to about that — the tolerance matches the input, not the algorithm.
    expect(studentTTwoTailed(t, df)).toBeCloseTo(alpha, 3);
  });

  it('is 1 at t = 0 — no evidence either way', () => {
    expect(studentTTwoTailed(0, 10)).toBeCloseTo(1, 10);
  });

  it('is symmetric in the sign of t', () => {
    expect(studentTTwoTailed(-2.1213, 8)).toBeCloseTo(studentTTwoTailed(2.1213, 8), 12);
  });
});

describe('pValue', () => {
  it('matches the t test for a coefficient and sample size', () => {
    // r = 0.6, n = 10 → t = 2.1213 on 8 df.
    expect(pValue(0.6, 10)).toBeCloseTo(0.0667, 4);
  });

  it('is 0 for a perfect fit and 1 for no relationship', () => {
    expect(pValue(1, 10)).toBe(0);
    expect(pValue(0, 10)).toBeCloseTo(1, 10);
  });

  it('falls as the sample grows for the same coefficient', () => {
    expect(pValue(0.4, 100)).toBeLessThan(pValue(0.4, 20));
  });
});

describe('correlate', () => {
  it('ranks before correlating for Spearman, so a monotone pair scores 1', () => {
    const result = correlate([1, 2, 3, 4, 5], [1, 10, 100, 1000, 10_000], 'spearman');

    expect(result?.coefficient).toBeCloseTo(1, 10);
    expect(result?.n).toBe(5);
    expect(result?.method).toBe('spearman');
  });

  it('reverses to −1 on a monotone decreasing pair', () => {
    expect(correlate([1, 2, 3, 4, 5], [5, 4, 3, 2, 1], 'spearman')?.coefficient).toBeCloseTo(
      -1,
      10,
    );
  });

  it('handles ties through averaged ranks', () => {
    // Ranks [1, 2.5, 2.5, 4] against [1, 2, 3, 4] give ρ ≈ 0.9487.
    expect(correlate([1, 2, 2, 3], [1, 2, 3, 4], 'spearman')?.coefficient).toBeCloseTo(0.9487, 4);
  });

  it('point-biserial is Pearson against a 0/1 Series', () => {
    const values = [3, 5, 8, 2, 9, 4];
    const binary = [0, 0, 1, 0, 1, 0];

    const result = correlate(values, binary, 'point-biserial');

    expect(result?.coefficient).toBeCloseTo(pearson(values, binary) ?? 0, 12);
    expect(result?.method).toBe('point-biserial');
  });

  it('counts only Buckets where both Series have a value', () => {
    const result = correlate([1, null, 3, 4, 5], [2, 4, null, 8, 10], 'spearman');

    expect(result?.n).toBe(3);
  });

  it('gives no result below three overlapping Buckets, rather than throwing', () => {
    expect(correlate([1, 2], [2, 4], 'spearman')).toBeNull();
    expect(correlate([1, null, 3], [1, 2, null], 'spearman')).toBeNull();
    expect(correlate([], [], 'spearman')).toBeNull();
  });

  it('gives no result when one Series never varies', () => {
    expect(correlate([1, 1, 1, 1], [1, 2, 3, 4], 'point-biserial')).toBeNull();
  });

  it('reports a p-value alongside the coefficient', () => {
    const result = correlate(
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      [2, 1, 4, 3, 6, 5, 8, 7, 10, 9],
      'spearman',
    );

    expect(result?.p).toBeGreaterThan(0);
    expect(result?.p).toBeLessThan(0.01);
  });
});
