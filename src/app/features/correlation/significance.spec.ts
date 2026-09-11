import { benjaminiHochberg } from './significance';

describe('benjaminiHochberg', () => {
  it('returns an empty array for empty input', () => {
    expect(benjaminiHochberg([], 0.05)).toEqual([]);
  });

  it('keeps everything significant at falseDiscoveryRate = 1 (every p <= 1)', () => {
    const results = benjaminiHochberg([0.9, 0.5, 0.99, 0.01], 1);
    expect(results.every((r) => r.significant)).toBe(true);
  });

  it('matches a hand-derived p-vector', () => {
    // p = [0.01, 0.04, 0.03, 0.005, 0.5] at indices [0..4], Q = 0.05, m = 5.
    // Sorted ascending: 0.005(#3) 0.01(#0) 0.03(#2) 0.04(#1) 0.5(#4).
    // BH thresholds (rank/m)*Q: rank1=0.01 rank2=0.02 rank3=0.03 rank4=0.04 rank5=0.05.
    // 0.005<=0.01 ✓ | 0.01<=0.02 ✓ | 0.03<=0.03 ✓ | 0.04<=0.04 ✓ | 0.5<=0.05 ✗
    // → largest passing rank = 4, so original indices [0,1,2,3] are significant, [4] is not.
    const results = benjaminiHochberg([0.01, 0.04, 0.03, 0.005, 0.5], 0.05);

    expect(results.map((r) => r.significant)).toEqual([true, true, true, true, false]);

    // q-values (running min of p*m/rank from the largest rank down):
    // rank5: 0.5*5/5=0.5 -> runningMin 0.5
    // rank4: 0.04*5/4=0.05 -> runningMin 0.05
    // rank3: 0.03*5/3=0.05 -> runningMin 0.05
    // rank2: 0.01*5/2=0.025 -> runningMin 0.025
    // rank1: 0.005*5/1=0.025 -> runningMin 0.025
    expect(results[3].adjustedPValue).toBeCloseTo(0.025, 9); // index 3, p=0.005, rank 1
    expect(results[0].adjustedPValue).toBeCloseTo(0.025, 9); // index 0, p=0.01, rank 2
    expect(results[2].adjustedPValue).toBeCloseTo(0.05, 9); // index 2, p=0.03, rank 3
    expect(results[1].adjustedPValue).toBeCloseTo(0.05, 9); // index 1, p=0.04, rank 4
    expect(results[4].adjustedPValue).toBeCloseTo(0.5, 9); // index 4, p=0.5, rank 5
  });

  it('returns results in the original input order', () => {
    const results = benjaminiHochberg([0.5, 0.1, 0.3], 0.05);
    expect(results.map((r) => r.index)).toEqual([0, 1, 2]);
  });

  it('adjusted p-values are monotone non-decreasing in sorted-p order', () => {
    const pValues = [0.2, 0.001, 0.5, 0.04, 0.03];
    const results = benjaminiHochberg(pValues, 0.05);
    const bySortedP = [...results].sort((a, b) => a.pValue - b.pValue);
    for (let i = 1; i < bySortedP.length; i++) {
      expect(bySortedP[i].adjustedPValue).toBeGreaterThanOrEqual(bySortedP[i - 1].adjustedPValue);
    }
  });
});
