import { adjustedPValues, benjaminiHochberg } from './significance';

describe('benjaminiHochberg', () => {
  it('matches the worked reference example', () => {
    // Benjamini & Hochberg's own example (1995), threshold 0.05: the four smallest
    // p-values are accepted, everything above them rejected.
    const pValues = [
      0.0001, 0.0004, 0.0019, 0.0095, 0.0201, 0.0278, 0.0298, 0.0344, 0.0459, 0.324, 0.4262, 0.5719,
      0.6528, 0.759, 1,
    ];

    expect(benjaminiHochberg(pValues, 0.05)).toEqual([
      true,
      true,
      true,
      true,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
    ]);
  });

  it('accepts a test ranked below the cutoff even when its own p misses its share', () => {
    // Ranks 1–3 of 3 at threshold 0.06: only rank 3 clears its own share (0.06), and the
    // step-up rule then accepts the two below it.
    expect(benjaminiHochberg([0.05, 0.04, 0.06], 0.06)).toEqual([true, true, true]);
  });

  it('keeps everything at a threshold of 1', () => {
    expect(benjaminiHochberg([0.9, 0.5, 1], 1)).toEqual([true, true, true]);
  });

  it('rejects everything when nothing clears the smallest share', () => {
    expect(benjaminiHochberg([0.4, 0.6, 0.8], 0.05)).toEqual([false, false, false]);
  });

  it('returns the flags in the order given, not in rank order', () => {
    expect(benjaminiHochberg([0.5, 0.001, 0.4], 0.05)).toEqual([false, true, false]);
  });

  it('has nothing to say about no tests', () => {
    expect(benjaminiHochberg([], 0.05)).toEqual([]);
  });
});

describe('adjustedPValues', () => {
  it('scales each p by the number of tests over its rank', () => {
    // p = 0.01 at rank 1 of 4 → 0.04; p = 0.04 at rank 2 → 0.08.
    const adjusted = adjustedPValues([0.01, 0.04, 0.3, 0.5]);

    expect(adjusted[0]).toBeCloseTo(0.04, 10);
    expect(adjusted[1]).toBeCloseTo(0.08, 10);
  });

  it('never exceeds 1', () => {
    expect(adjustedPValues([0.9, 0.95, 1]).every((value) => value <= 1)).toBe(true);
  });

  it('stays monotone, so a smaller raw p never looks less significant', () => {
    const raw = [0.01, 0.02, 0.025, 0.9];
    const adjusted = adjustedPValues(raw);

    expect(adjusted[0]).toBeLessThanOrEqual(adjusted[1]);
    expect(adjusted[1]).toBeLessThanOrEqual(adjusted[2]);
    expect(adjusted[2]).toBeLessThanOrEqual(adjusted[3]);
  });

  it('has nothing to say about no tests', () => {
    expect(adjustedPValues([])).toEqual([]);
  });
});
