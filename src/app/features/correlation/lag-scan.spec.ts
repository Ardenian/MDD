import { scanLags } from './lag-scan';
import { spearmanCorrelation } from './correlation-stats';
import type { Signal, SignalPoint } from './signal-extraction';

const DAY_MS = 86_400_000;
// A fixed, non-monotonic permutation — so only the correct lag realigns the pattern;
// a monotonic ramp would correlate perfectly at *every* lag and couldn't distinguish them.
const PATTERN = [3, 7, 1, 9, 4, 8, 2, 10, 5, 6];

function dayKey(offsetDays: number): string {
  return new Date(Date.parse('2026-01-01T00:00:00.000Z') + offsetDays * DAY_MS).toISOString().slice(0, 10);
}

function signalShiftedBy(name: string, offsetDays: number): Signal {
  const points: SignalPoint[] = PATTERN.map((value, i) => ({ bucketKey: dayKey(i + offsetDays), value }));
  return { name, points };
}

describe('scanLags', () => {
  it('identifies a +2 Bucket shift as the best Lag, with a near-perfect correlation there', () => {
    const a = signalShiftedBy('A', 0);
    const b = signalShiftedBy('B', 2);

    const result = scanLags(a, b, 'day', { min: -3, max: 3 }, spearmanCorrelation);

    expect(result.bestLag).toBe(2);
    expect(result.bestResult).not.toBeNull();
    expect(result.bestResult!.effectSize).toBeCloseTo(1, 9);
  });

  it('always reports a zero-Lag result when the Buckets overlap at all, even if it is not the best', () => {
    const a = signalShiftedBy('A', 0);
    const b = signalShiftedBy('B', 2);

    const result = scanLags(a, b, 'day', { min: -3, max: 3 }, spearmanCorrelation);

    expect(result.zeroLag).not.toBeNull();
    expect(Math.abs(result.zeroLag!.effectSize)).toBeLessThan(Math.abs(result.bestResult!.effectSize));
  });

  it('handles negative Lags symmetrically', () => {
    const a = signalShiftedBy('A', 0);
    const b = signalShiftedBy('B', -2);

    const result = scanLags(a, b, 'day', { min: -3, max: 3 }, spearmanCorrelation);

    expect(result.bestLag).toBe(-2);
    expect(result.bestResult!.effectSize).toBeCloseTo(1, 9);
  });

  it('returns null results (never throws) when there is no overlap at any Lag', () => {
    const a = signalShiftedBy('A', 0);
    const b = signalShiftedBy('B', 1000); // far outside the scanned range

    const result = scanLags(a, b, 'day', { min: -3, max: 3 }, spearmanCorrelation);

    expect(result.zeroLag).toBeNull();
    expect(result.bestResult).toBeNull();
    expect(result.bestLag).toBe(0);
  });
});
