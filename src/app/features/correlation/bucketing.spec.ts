import { bucketContaining, bucketIndexForKey, bucketKeyForIndex, bucketWeightsFor, type BucketSize } from './bucketing';
import type { Placement } from '../../data/model/entry';

const DAY_MS = 86_400_000;

describe('bucketContaining', () => {
  it('resolves hour buckets', () => {
    const bucket = bucketContaining(Date.parse('2026-01-01T10:37:12.000Z'), 'hour');
    expect(bucket.start).toBe(Date.parse('2026-01-01T10:00:00.000Z'));
    expect(bucket.end).toBe(Date.parse('2026-01-01T11:00:00.000Z'));
  });

  it('resolves day buckets', () => {
    const bucket = bucketContaining(Date.parse('2026-01-01T23:59:59.000Z'), 'day');
    expect(bucket.key).toBe('2026-01-01');
    expect(bucket.end).toBe(Date.parse('2026-01-02T00:00:00.000Z'));
  });

  it('resolves ISO (Monday-start) week buckets — 2024-01-01 is a known Monday', () => {
    const wednesday = bucketContaining(Date.parse('2024-01-03T12:00:00.000Z'), 'week');
    expect(wednesday.key).toBe('2024-01-01');
    expect(wednesday.start).toBe(Date.parse('2024-01-01T00:00:00.000Z'));
    expect(wednesday.end).toBe(Date.parse('2024-01-08T00:00:00.000Z'));

    const sunday = bucketContaining(Date.parse('2024-01-07T12:00:00.000Z'), 'week');
    expect(sunday.key).toBe('2024-01-01');
  });

  it('resolves month buckets with correct calendar lengths, including a leap February', () => {
    const leapFeb = bucketContaining(Date.parse('2024-02-15T00:00:00.000Z'), 'month');
    expect(leapFeb.end - leapFeb.start).toBe(29 * DAY_MS);

    const nonLeapFeb = bucketContaining(Date.parse('2023-02-15T00:00:00.000Z'), 'month');
    expect(nonLeapFeb.end - nonLeapFeb.start).toBe(28 * DAY_MS);

    const thirtyOneDayMonth = bucketContaining(Date.parse('2024-01-15T00:00:00.000Z'), 'month');
    expect(thirtyOneDayMonth.end - thirtyOneDayMonth.start).toBe(31 * DAY_MS);

    const thirtyDayMonth = bucketContaining(Date.parse('2024-04-15T00:00:00.000Z'), 'month');
    expect(thirtyDayMonth.end - thirtyDayMonth.start).toBe(30 * DAY_MS);
  });
});

describe('bucketWeightsFor', () => {
  it('gives a Point with no Fadeout weight 1 in exactly one Bucket', () => {
    const placement: Placement = { kind: 'point', at: '2026-01-01T10:01:00.000Z', fadeout: null };
    const weights = bucketWeightsFor(placement, 'day');

    expect(weights).toEqual([{ bucketKey: '2026-01-01', weight: 1 }]);
  });

  it('splits a Point + 1h trailing Fadeout crossing a day boundary 75/25', () => {
    const placement: Placement = {
      kind: 'point',
      at: '2026-01-01T23:30:00.000Z',
      fadeout: { beforeMinutes: 0, afterMinutes: 60 },
    };

    const weights = bucketWeightsFor(placement, 'day');
    const byKey = Object.fromEntries(weights.map((w) => [w.bucketKey, w.weight]));

    expect(byKey['2026-01-01']).toBeCloseTo(0.75, 6);
    expect(byKey['2026-01-02']).toBeCloseTo(0.25, 6);
    expect(weights.reduce((sum, w) => sum + w.weight, 0)).toBeCloseTo(1, 9);
  });

  it('splits a 3-day Period across 3 daily Buckets proportionally (≈1/3 each)', () => {
    const placement: Placement = {
      kind: 'period',
      start: '2026-01-01T00:00:00.000Z',
      end: '2026-01-04T00:00:00.000Z',
      fadeout: null,
    };

    const weights = bucketWeightsFor(placement, 'day');

    expect(weights).toHaveLength(3);
    for (const { weight } of weights) {
      expect(weight).toBeCloseTo(1 / 3, 9);
    }
  });

  it('every Bucket weight for an Entry always sums to 1, with or without Fadeout', () => {
    const placements: Placement[] = [
      { kind: 'point', at: '2026-01-01T10:00:00.000Z', fadeout: null },
      {
        kind: 'period',
        start: '2026-01-01T09:02:00.000Z',
        end: '2026-01-01T10:03:00.000Z',
        fadeout: { beforeMinutes: 30, afterMinutes: 60 },
      },
      { kind: 'dayBucketed', day: '2026-01-01' },
    ];

    for (const placement of placements) {
      const total = bucketWeightsFor(placement, 'hour').reduce((sum, w) => sum + w.weight, 0);
      expect(total).toBeCloseTo(1, 9);
    }
  });
});

describe('bucketIndexForKey / bucketKeyForIndex', () => {
  const sizes: readonly BucketSize[] = ['hour', 'day', 'week', 'month'];

  it('round-trips a real Bucket key through index and back, for every size', () => {
    const timestamp = Date.parse('2026-03-17T14:00:00.000Z'); // an arbitrary Tuesday
    for (const size of sizes) {
      const key = bucketContaining(timestamp, size).key;
      expect(bucketKeyForIndex(bucketIndexForKey(key, size), size)).toBe(key);
    }
  });

  it('assigns consecutive real Buckets consecutive indices, for every size', () => {
    for (const size of sizes) {
      const first = bucketContaining(Date.parse('2026-03-17T00:00:00.000Z'), size);
      const second = bucketContaining(first.end + 1, size); // 1ms into the next Bucket
      expect(bucketIndexForKey(second.key, size)).toBe(bucketIndexForKey(first.key, size) + 1);
    }
  });

  it('places a known Monday (2024-01-01) at a whole-number week index', () => {
    expect(Number.isInteger(bucketIndexForKey('2024-01-01', 'week'))).toBe(true);
    expect(bucketKeyForIndex(bucketIndexForKey('2024-01-01', 'week'), 'week')).toBe('2024-01-01');
  });
});
