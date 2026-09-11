import { resolveCoveredInterval } from './fadeout';
import type { Placement } from '../../data/model/entry';

describe('resolveCoveredInterval', () => {
  it('resolves a Point with a trailing Fadeout to [10:01, 11:01]', () => {
    const placement: Placement = {
      kind: 'point',
      at: '2026-01-01T10:01:00.000Z',
      fadeout: { beforeMinutes: 0, afterMinutes: 60 },
    };

    const interval = resolveCoveredInterval(placement);

    expect(interval.start.toISOString()).toBe('2026-01-01T10:01:00.000Z');
    expect(interval.end.toISOString()).toBe('2026-01-01T11:01:00.000Z');
  });

  it('resolves a Period 09:02-10:03 with 30m/60m Fadeout to [08:32, 11:03]', () => {
    const placement: Placement = {
      kind: 'period',
      start: '2026-01-01T09:02:00.000Z',
      end: '2026-01-01T10:03:00.000Z',
      fadeout: { beforeMinutes: 30, afterMinutes: 60 },
    };

    const interval = resolveCoveredInterval(placement);

    expect(interval.start.toISOString()).toBe('2026-01-01T08:32:00.000Z');
    expect(interval.end.toISOString()).toBe('2026-01-01T11:03:00.000Z');
  });

  it('resolves a Day-bucketed placement to the whole UTC day, with no Fadeout possible', () => {
    const placement: Placement = { kind: 'dayBucketed', day: '2026-01-01' };
    const interval = resolveCoveredInterval(placement);

    expect(interval.start.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(interval.end.toISOString()).toBe('2026-01-02T00:00:00.000Z');
  });

  it('resolves a Point/Period with no Fadeout to its bare instant/span', () => {
    const point: Placement = { kind: 'point', at: '2026-01-01T10:00:00.000Z', fadeout: null };
    const interval = resolveCoveredInterval(point);
    expect(interval.start.getTime()).toBe(interval.end.getTime());
  });
});
