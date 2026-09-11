import {
  cramersV,
  pearsonCorrelation,
  pointBiserialCorrelation,
  spearmanCorrelation,
  type ContingencyTable,
} from './correlation-stats';

describe('spearmanCorrelation', () => {
  it('is -1 for a perfectly monotonically decreasing series', () => {
    const x = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const y = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1];

    const result = spearmanCorrelation(x, y)!;

    expect(result.effectSize).toBeCloseTo(-1, 9);
    expect(result.pValue).toBeCloseTo(0, 9);
    expect(result.n).toBe(10);
  });

  it('handles tied ranks (averaged) against a hand-computed fixture', () => {
    // x has a tie at rank 2/3 (both value 2); ranks(x) = [1, 2.5, 2.5, 4].
    const x = [1, 2, 2, 3];
    const y = [1, 2, 3, 4];

    const result = spearmanCorrelation(x, y)!;

    expect(result.effectSize).toBeCloseTo(Math.sqrt(0.9), 9);
  });

  it('returns null for fewer than 3 points, rather than throwing', () => {
    expect(spearmanCorrelation([1, 2], [1, 2])).toBeNull();
    expect(() => spearmanCorrelation([1, 2], [1, 2])).not.toThrow();
  });
});

describe('pointBiserialCorrelation', () => {
  it('is exactly the Pearson correlation of the numeric series and the 0/1 series', () => {
    const numeric = [1, 2, 3, 4, 5, 6];
    const binary = [0, 0, 0, 1, 1, 1];

    const result = pointBiserialCorrelation(numeric, binary)!;

    expect(result.effectSize).toBeCloseTo(pearsonCorrelation(numeric, binary), 12);
  });

  it('returns null for fewer than 3 points', () => {
    expect(pointBiserialCorrelation([1], [0])).toBeNull();
  });
});

describe('cramersV', () => {
  it('is 0 for a table with no association', () => {
    const table: ContingencyTable = { rows: 2, cols: 2, counts: [[10, 10], [10, 10]] };
    const result = cramersV(table)!;

    expect(result.effectSize).toBeCloseTo(0, 9);
    expect(result.pValue).toBeCloseTo(1, 6);
  });

  it('matches a hand-computed 2x2 table (chi-square 20, V = 0.5)', () => {
    const table: ContingencyTable = { rows: 2, cols: 2, counts: [[30, 10], [10, 30]] };
    const result = cramersV(table)!;

    expect(result.effectSize).toBeCloseTo(0.5, 9);
    expect(result.n).toBe(80);
    expect(result.pValue).toBeLessThan(0.001);
  });

  it('returns null for fewer than 3 total observations', () => {
    const table: ContingencyTable = { rows: 2, cols: 2, counts: [[1, 0], [0, 1]] };
    expect(cramersV(table)).toBeNull();
  });
});

describe('p-values: correctness properties of the underlying incomplete beta/gamma math', () => {
  // A fragile earlier version of this suite tried to hit exact t-table critical values
  // via a constructed data series, which turned out to depend on an unproven "Spearman
  // equals Pearson here" assumption. These instead check properties that are true by
  // definition of a two-tailed p-value, so they don't depend on any external table.

  it('r = 0 (exactly, by construction) gives p = 1', () => {
    // dot([-1,0,1], [1,-2,1]) = -1*1 + 0*-2 + 1*1 = 0, so Pearson r is exactly 0.
    const result = pointBiserialCorrelation([-1, 0, 1], [1, -2, 1])!;
    expect(result.effectSize).toBeCloseTo(0, 12);
    expect(result.pValue).toBeCloseTo(1, 9);
  });

  it('a stronger correlation yields a smaller p-value at the same n', () => {
    const weak = pointBiserialCorrelation([1, 2, 3, 4, 5], [2, 1, 4, 3, 5])!;
    const strong = pointBiserialCorrelation([1, 2, 3, 4, 5], [1, 2, 3, 4, 6])!;
    expect(strong.effectSize).toBeGreaterThan(weak.effectSize);
    expect(strong.pValue).toBeLessThan(weak.pValue);
  });

  it('is symmetric under sign-flipping one series (two-tailed test)', () => {
    const x = [1, 2, 3, 4, 5];
    const y = [2, 1, 4, 3, 6];
    const positive = pointBiserialCorrelation(x, y)!;
    const negated = pointBiserialCorrelation(x, y.map((v) => -v))!;
    expect(negated.effectSize).toBeCloseTo(-positive.effectSize, 12);
    expect(negated.pValue).toBeCloseTo(positive.pValue, 12);
  });

  it('matches the standard chi-square table value: chi-square 3.841 at df 1 is alpha 0.05', () => {
    // A symmetric 2x2 table [[k, m-k], [m-k, k]] has row/col totals m, n = 2m, and every
    // expected cell m/2, so chiSquare = 4*(k-m/2)^2/(m/2) = 8*(k-m/2)^2/m. Solved here
    // for chiSquare = 3.841, m = 40 (verified against the cramersV 0.5 fixture's own
    // hand-computed chi-square of 20 above, using the same table shape with k = 30).
    const m = 40;
    const k = m / 2 + Math.sqrt((3.841 * m) / 8);
    const table: ContingencyTable = {
      rows: 2,
      cols: 2,
      counts: [
        [k, m - k],
        [m - k, k],
      ],
    };

    expect(cramersV(table)!.pValue).toBeCloseTo(0.05, 2);
  });
});
