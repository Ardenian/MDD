import type { Placement } from '../../data/model/placement';
import { bucketIndexOf, bucketWeights, createBucketAxis } from './bucketing';

/** Local time throughout, like the rest of the app — never UTC. */
function at(year: number, month: number, day: number, hour = 0, minute = 0): string {
  return new Date(year, month - 1, day, hour, minute).toISOString();
}

function axisOf(size: 'hour' | 'day' | 'week' | 'month', from: string, to: string) {
  return createBucketAxis({ start: Date.parse(from), end: Date.parse(to) }, size);
}

function weightsByIndex(memberships: readonly { index: number; weight: number }[]) {
  return memberships.map(({ index, weight }) => [index, Number(weight.toFixed(6))]);
}

describe('createBucketAxis', () => {
  it('starts on the local boundary containing the range start', () => {
    const axis = axisOf('day', at(2026, 3, 10, 14, 30), at(2026, 3, 12, 9, 0));

    expect(axis.count).toBe(3);
    expect(new Date(axis.boundaries[0]).getHours()).toBe(0);
    expect(new Date(axis.boundaries[0]).getDate()).toBe(10);
  });

  it('gives every hour of a day its own Bucket', () => {
    const axis = axisOf('hour', at(2026, 3, 10, 0, 0), at(2026, 3, 10, 23, 59));

    expect(axis.count).toBe(24);
  });

  it('starts weekly Buckets on Monday (ISO 8601)', () => {
    // 2026-03-11 is a Wednesday.
    const axis = axisOf('week', at(2026, 3, 11), at(2026, 3, 12));

    expect(axis.count).toBe(1);
    expect(new Date(axis.boundaries[0]).getDay()).toBe(1);
    expect(new Date(axis.boundaries[0]).getDate()).toBe(9);
  });

  it('follows real month lengths rather than a fixed step', () => {
    const axis = axisOf('month', at(2026, 1, 15), at(2026, 3, 15));

    expect(axis.count).toBe(3);
    const lengths = [0, 1, 2].map(
      (index) => (axis.boundaries[index + 1] - axis.boundaries[index]) / 86_400_000,
    );
    expect(lengths).toEqual([31, 28, 31]);
  });

  it('keeps a daily Bucket a real day across a daylight-saving change', () => {
    // Europe/Berlin springs forward on 2026-03-29; that local day is 23 hours long.
    const axis = axisOf('day', at(2026, 3, 29), at(2026, 3, 30, 12, 0));
    const first = (axis.boundaries[1] - axis.boundaries[0]) / 3_600_000;

    expect([23, 24, 25]).toContain(first);
  });
});

describe('bucketIndexOf', () => {
  const axis = axisOf('day', at(2026, 3, 10), at(2026, 3, 12, 23, 59));

  it('finds the Bucket an instant falls in', () => {
    expect(bucketIndexOf(axis, Date.parse(at(2026, 3, 11, 13, 0)))).toBe(1);
  });

  it('puts a boundary instant in the Bucket it opens', () => {
    expect(bucketIndexOf(axis, axis.boundaries[2])).toBe(2);
  });

  it('reports instants outside the axis as absent', () => {
    expect(bucketIndexOf(axis, Date.parse(at(2026, 3, 9, 23, 0)))).toBe(-1);
    expect(bucketIndexOf(axis, Date.parse(at(2026, 3, 13, 0, 30)))).toBe(-1);
  });
});

describe('bucketWeights', () => {
  describe('a Point', () => {
    const axis = axisOf('day', at(2026, 3, 10), at(2026, 3, 12, 23, 59));

    it('with no Fadeout weighs 1 in the single Bucket it falls in', () => {
      const placement: Placement = { kind: 'point', at: at(2026, 3, 11, 13, 0) };

      expect(weightsByIndex(bucketWeights(axis, placement))).toEqual([[1, 1]]);
    });

    it('splits linearly across a boundary its trailing Fadeout crosses', () => {
      // 23:30 with an hour of trailing uncertainty: three quarters of the Point's
      // weight lies before midnight, one quarter after.
      const placement: Placement = {
        kind: 'point',
        at: at(2026, 3, 10, 23, 30),
        fadeout: { beforeMinutes: 0, afterMinutes: 60 },
      };

      expect(weightsByIndex(bucketWeights(axis, placement))).toEqual([
        [0, 0.75],
        [1, 0.25],
      ]);
    });

    it('spreads a symmetric Fadeout evenly either side of a boundary', () => {
      const placement: Placement = {
        kind: 'point',
        at: at(2026, 3, 11, 0, 0),
        fadeout: { beforeMinutes: 60, afterMinutes: 60 },
      };

      expect(weightsByIndex(bucketWeights(axis, placement))).toEqual([
        [0, 0.5],
        [1, 0.5],
      ]);
    });

    it('always spends exactly one Entry of weight, however wide the Fadeout', () => {
      const placement: Placement = {
        kind: 'point',
        at: at(2026, 3, 11, 12, 0),
        fadeout: { beforeMinutes: 24 * 60, afterMinutes: 24 * 60 },
      };

      const total = bucketWeights(axis, placement).reduce((sum, { weight }) => sum + weight, 0);

      expect(total).toBeCloseTo(1, 6);
    });
  });

  describe('a Period', () => {
    const axis = axisOf('day', at(2026, 3, 10), at(2026, 3, 12, 23, 59));

    it('weighs each Bucket by the share of it the Period covers', () => {
      const placement: Placement = {
        kind: 'period',
        start: at(2026, 3, 10, 12, 0),
        end: at(2026, 3, 12, 12, 0),
      };

      expect(weightsByIndex(bucketWeights(axis, placement))).toEqual([
        [0, 0.5],
        [1, 1],
        [2, 0.5],
      ]);
    });

    it('ramps down through a trailing Fadeout rather than stopping dead', () => {
      const hourly = axisOf('hour', at(2026, 3, 10, 0, 0), at(2026, 3, 10, 5, 59));
      const placement: Placement = {
        kind: 'period',
        start: at(2026, 3, 10, 1, 0),
        end: at(2026, 3, 10, 2, 0),
        fadeout: { beforeMinutes: 0, afterMinutes: 60 },
      };

      // Hour 1 is fully inside the Period; hour 2 is the Fadeout ramping 1 → 0.
      expect(weightsByIndex(bucketWeights(hourly, placement))).toEqual([
        [1, 1],
        [2, 0.5],
      ]);
    });
  });

  describe('a Day-bucketed Entry', () => {
    it('weighs 1 in its own day', () => {
      const axis = axisOf('day', at(2026, 3, 10), at(2026, 3, 12, 23, 59));
      const placement: Placement = { kind: 'dayBucketed', day: '2026-03-11' };

      expect(weightsByIndex(bucketWeights(axis, placement))).toEqual([[1, 1]]);
    });

    it('weighs 1 in every hour of that day when Buckets are hourly', () => {
      const axis = axisOf('hour', at(2026, 3, 11, 0, 0), at(2026, 3, 11, 23, 59));
      const placement: Placement = { kind: 'dayBucketed', day: '2026-03-11' };

      const memberships = bucketWeights(axis, placement);

      expect(memberships).toHaveLength(24);
      expect(memberships.every(({ weight }) => Math.abs(weight - 1) < 1e-6)).toBe(true);
    });
  });

  it('ignores the part of a placement that falls outside the axis', () => {
    const axis = axisOf('day', at(2026, 3, 11), at(2026, 3, 11, 23, 59));
    const placement: Placement = {
      kind: 'period',
      start: at(2026, 3, 10, 12, 0),
      end: at(2026, 3, 12, 12, 0),
    };

    expect(weightsByIndex(bucketWeights(axis, placement))).toEqual([[0, 1]]);
  });

  it('reports nothing for a placement entirely outside the axis', () => {
    const axis = axisOf('day', at(2026, 3, 11), at(2026, 3, 11, 23, 59));
    const placement: Placement = { kind: 'point', at: at(2026, 4, 1, 9, 0) };

    expect(bucketWeights(axis, placement)).toEqual([]);
  });
});
